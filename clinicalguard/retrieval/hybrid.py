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
    embeddings = db.query(ConditionEmbedding).all()

    corpus = [e.embedding_text for e in embeddings]
    condition_ids = [e.condition_id for e in embeddings]

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