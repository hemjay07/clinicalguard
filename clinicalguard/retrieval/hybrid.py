import logging
from dataclasses import dataclass

from rank_bm25 import BM25Okapi
from sqlalchemy.orm import Session
from sqlalchemy import text

from clinicalguard.db.models import Condition, ConditionEmbedding
from clinicalguard.ingestion.embeddings import EMBEDDING_MODEL, client

logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    condition_id: int
    condition_name: str
    score: float
    semantic_rank: int | None
    bm25_rank: int | None


def embed_query(query: str) -> list[float]:
    response = client.embeddings.create(
        input=query,
        model=EMBEDDING_MODEL,
    )
    return response.data[0].embedding


def semantic_search(
    query_vector: list[float],
    db: Session,
    top_k: int = 20,
) -> list[tuple[int, str, float]]:
    # pgvector cosine distance operator (<=>).
    # We convert to similarity with 1 - distance so higher = more relevant.
    # Fetching top 20 before fusion gives RRF enough candidates to work with.
    # Fetching only top_k here would cut off results that BM25 ranks highly.
    results = db.execute(
        text("""
            SELECT c.id, c.name, 1 - (ce.embedding <=> :query_vector) AS similarity
            FROM condition_embeddings ce
            JOIN conditions c ON c.id = ce.condition_id
            ORDER BY ce.embedding <=> :query_vector
            LIMIT :top_k
        """),
        {"query_vector": str(query_vector), "top_k": top_k},
    ).fetchall()
    return [(row[0], row[1], row[2]) for row in results]


def bm25_search(
    query: str,
    db: Session,
    top_k: int = 20,
) -> list[tuple[int, str, float]]:
    # BM25 handles exact term matching that semantic search misses.
    # Critical for clinical queries: drug names, procedure names, and
    # condition-specific terminology must match exactly, not approximately.
    # For example, "artemether-lumefantrine" should not match "lumefantrine"
    # at a reduced score — it either matches or it doesn't.
    embeddings = db.query(ConditionEmbedding).all()

    corpus = [e.embedding_text for e in embeddings]
    condition_ids = [e.condition_id for e in embeddings]

    # BM25 index is rebuilt on every query. This is acceptable at current
    # scale (251 conditions) but is tracked as technical debt for Phase 3
    # when the index should be built once at startup and cached in memory.
    tokenized_corpus = [doc.lower().split() for doc in corpus]
    bm25 = BM25Okapi(tokenized_corpus)

    tokenized_query = query.lower().split()
    scores = bm25.get_scores(tokenized_query)

    ranked = sorted(
        zip(condition_ids, scores),
        key=lambda x: x[1],
        reverse=True,
    )[:top_k]

    condition_names = {
        c.id: c.name
        for c in db.query(Condition).filter(
            Condition.id.in_([r[0] for r in ranked])
        ).all()
    }

    return [(cid, condition_names.get(cid, ""), score) for cid, score in ranked]


def reciprocal_rank_fusion(
    semantic_results: list[tuple[int, str, float]],
    bm25_results: list[tuple[int, str, float]],
    k: int = 60,
) -> list[RetrievalResult]:
    # RRF chosen over weighted average for two reasons:
    # 1. Scale mismatch: cosine similarity scores are bounded (0-1),
    #    BM25 scores are unbounded and vary by corpus size. A weighted
    #    average would let one scale dominate without explicit tuning.
    # 2. No manual weight tuning: RRF uses only rank position, not raw
    #    scores. The formula 1/(k + rank) naturally boosts documents that
    #    appear in both result sets without requiring per-query weight adjustment.
    #
    # k=60 is the standard RRF constant from the original paper (Cormack et al.).
    # It dampens the influence of very high ranks without eliminating them.
    scores: dict[int, float] = {}
    names: dict[int, str] = {}
    semantic_ranks: dict[int, int] = {}
    bm25_ranks: dict[int, int] = {}

    for rank, (cid, name, _) in enumerate(semantic_results, 1):
        scores[cid] = scores.get(cid, 0) + 1 / (k + rank)
        names[cid] = name
        semantic_ranks[cid] = rank

    for rank, (cid, name, _) in enumerate(bm25_results, 1):
        scores[cid] = scores.get(cid, 0) + 1 / (k + rank)
        names[cid] = name
        bm25_ranks[cid] = rank

    sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    return [
        RetrievalResult(
            condition_id=cid,
            condition_name=names[cid],
            score=score,
            semantic_rank=semantic_ranks.get(cid),
            bm25_rank=bm25_ranks.get(cid),
        )
        for cid, score in sorted_results
    ]


def generate_hypothetical_passage(query: str) -> str:
    # HyDE (Hypothetical Document Embeddings): instead of embedding the raw
    # query, we generate a hypothetical clinical guideline passage and embed
    # that instead. This improves recall for constitutional symptom queries
    # where individual symptom words are too common to discriminate well.
    # Example: "productive cough night sweats weight loss" — each symptom
    # appears in dozens of conditions. A generated TB passage produces a
    # vector that lands closer to the actual TB guideline embedding.
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a clinical guideline assistant. Generate a brief passage from a Nigerian clinical guideline that would answer the following query. Be specific and clinical.",
            },
            {
                "role": "user",
                "content": query,
            }
        ],
        max_tokens=200,
    )
    return response.choices[0].message.content


def hybrid_search(
    query: str,
    db: Session,
    top_k: int = 5,
    use_hyde: bool = False,
) -> list[RetrievalResult]:
    # HyDE is opt-in rather than default for two reasons:
    # 1. Most clinical queries have specific enough terms that raw query
    #    embedding works well. HyDE adds latency and an extra LLM call
    #    that is only worth paying for vague or symptom-constellation queries.
    # 2. HyDE's generation step can introduce hallucinated clinical context
    #    that pollutes the embedding for precise queries (e.g. drug names).
    #    The caller decides when the query warrants it.
    logger.info(f"Hybrid search: '{query}' (HyDE: {use_hyde})")

    if use_hyde:
        hypothetical = generate_hypothetical_passage(query)
        query_vector = embed_query(hypothetical)
    else:
        query_vector = embed_query(query)

    semantic_results = semantic_search(query_vector, db, top_k=20)
    bm25_results = bm25_search(query, db, top_k=20)
    fused = reciprocal_rank_fusion(semantic_results, bm25_results)

    logger.info(f"Returning top {top_k} results")
    return fused[:top_k]