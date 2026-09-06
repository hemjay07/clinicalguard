# Decomposition rulebook — held privately

The decomposition rulebook (`decomposition_rulebook.yaml`, and the
`decomposition_rulebook.md` generated from it) is not in this repository. It is
kept in a private repository until the decomposition study closes, and will be
published alongside the paper. The study measures whether physicians
independently arrive at the same rules for splitting bundled rubric items, so
publishing the rules while rating is open would contaminate the very thing
being measured (ADR-032). Nothing changes for anyone running this code with the
file in place: `load_rulebook()` reads `docs/decomposition_rulebook.yaml` at the
same path as before, and still fails loudly rather than falling back to a
hardcoded prompt if the file is absent.
