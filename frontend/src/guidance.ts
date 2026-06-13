// Authoring guidance. These four texts are shown opt-in (behind "?" icons) and
// must be used VERBATIM as supplied in the PRD — they shape how MDs author and
// must not be paraphrased.

export const QUERY_GUIDANCE = `Writing the clinical query

A clinical AI eval query is a clinical scenario the AI is asked to respond to. It tests whether the AI can reason through a realistic clinical situation, not whether it can recall facts.

A strong query has these properties:

1. Specific demographics. Age, sex when relevant, population context if it matters (pregnant, newborn, elderly). Generic "adult patient" is acceptable when demographics aren't part of what's being tested, but specifics make the query more realistic.

2. Concrete presentation. Symptoms, findings, lab values, or context details that an actual patient would present with. Avoid abstract "patient with hypertension" framings — instead, describe the presentation that would lead to that diagnosis.

3. Explicit scope. End the query with what the AI is being asked to address: "diagnosis and management", "initial management given confirmed diagnosis", "complication recognition", "drug selection avoiding contraindications". This tells the AI what the answer should cover and helps reviewers evaluate the response against the right criteria.

4. Realistic clinical setting. Where would this patient be encountered? Implied through context details: "presenting for routine check-up", "brought to emergency department", "in antenatal clinic". This grounds the scenario.

Examples of strong queries:

- "40-year-old adult presenting with 2 months of polyuria, polydipsia, and unexplained weight loss; random blood glucose 14 mmol/L — diagnosis and initial management"
- "Adult patient with high fever, altered consciousness, and recent travel to endemic area — diagnosis and management"
- "52-year-old man presenting for routine check-up with blood pressure readings of 162/98 mmHg on two separate visits one month apart, asymptomatic, no known comorbidities — diagnosis and initial management"

Examples of weak queries:

- "What is the treatment for malaria?" — Too abstract. Tests fact recall, not clinical reasoning. There's no patient.
- "Patient with fever — what's the diagnosis?" — Underspecified. Many conditions cause fever. Not enough information to reason from.
- "Adult patient with severe complicated malaria — diagnosis and management" — The diagnosis is in the query. The case tests management of a known diagnosis, not diagnostic reasoning.

Write the query in 1-3 sentences. Don't pack everything into the query — irrelevant detail makes the case worse, not better.`;

export const TIER_GUIDANCE = `About the tier categories

You're sorting items into three categories based on how the AI's response should treat them:

Required: omission would be a clinical failure. The AI must address this. A response missing a required item should fail the case.

Expected: a thorough response should include this. Absence reduces response quality but isn't dangerous. The AI is penalized but not failed for omitting it.

Situational: only required if a specific clinical trigger appears in the AI's response. For example, CSF analysis becomes required if the AI raises meningitis as a differential.

Use clinical judgment. There's no formula. Required is for items that a competent clinician would never omit for this scenario. Expected is for items a thorough clinician would include. Situational is for items whose relevance depends on how the AI frames the clinical picture.`;

export const TRIGGER_GUIDANCE = `Writing situational triggers

A trigger describes the clinical reasoning that makes a situational item required. The format is:

[item] — trigger: [the clinical reasoning that activates this requirement]

Examples:
- "CSF analysis — trigger: AI raises meningitis as a differential"
- "Blood culture — trigger: AI mentions sepsis or bacteremia"
- "Pregnancy test — trigger: AI considers medications that are contraindicated in pregnancy"

Triggers are read by the eval scorer when grading responses. Write them so a reviewer can clearly tell whether the trigger fired in any given response.`;

export const WHAT_THIS_EVALUATES_GUIDANCE = `What this case evaluates

In one or two sentences, describe what aspect of clinical reasoning this case is designed to test. This becomes metadata on the case and helps:

- Second reviewers understand your authoring intent
- Future users of the framework understand what each case is for
- The methodology documentation explain coverage of different clinical reasoning skills

Examples:

"Tests recognition of severe malaria features in a patient with possible cerebral involvement, including differentiation from other causes of altered consciousness in a febrile patient."

"Tests appropriate initial management of newly-diagnosed type 2 diabetes, including weight assessment, lifestyle counseling, and decision-making about pharmacotherapy."

"Tests recognition of stage 2 hypertension based on diagnostic criteria (two readings on separate occasions) and appropriate initial workup before treatment."

The field is optional but strongly recommended. Cases without this metadata are harder to interpret.`;
