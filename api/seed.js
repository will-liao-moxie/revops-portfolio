import { requireEditKey, parseBody, getProjects, saveProjects } from "./_lib/kv.js";

const SEED = [
  {
    id: "ms-01", code: "MS-01", title: "Multi-Touch Attribution Model",
    workstream: "Marketing Services", stakeholder: "Marketing Services (Paid Media)",
    revopsRole: "Project coordinator + systems build", devResources: "Data team",
    contractors: [], teams: ["Marketing Services", "RevOps", "Data"],
    problem: "Moxie lacks a unified attribution model linking paid advertising (Meta/Google) to revenue. Current pipelines only track Meta form submissions, missing primary Google Ads drivers like phone calls. We cannot differentiate organic vs. paid traffic or view cross-channel patient journeys, preventing data-backed marketing decisions.",
    solution: "Build a multi-touch attribution architecture recording every interaction (forms, calls, visits, referrals) as a timestamped touchpoint, rolling up to patient bookings for cross-channel reporting. After a Data-led build-vs-buy evaluation, integrate attribution data into Omni, Practice Accelerator, HubSpot, and ClickUp.",
    deliverables: [
      { text: "Build vs. buy evaluation (Data / RevOps / Marketing)", stretch: false },
      { text: "Defined attribution touchpoints (forms, calls, clicks, referrals)", stretch: false },
      { text: "Attribution logic — models, 90-day window", stretch: false },
      { text: "Phone call tracking for Google Ads", stretch: false },
      { text: "Cross-channel deduplication", stretch: false },
      { text: "Organic vs. paid traffic differentiation", stretch: false },
      { text: "Omni reporting layer", stretch: false },
      { text: "HubSpot + ClickUp sync", stretch: false },
      { text: "Practice Accelerator integration", stretch: true },
    ],
    roles: [
      { who: "Marketing Services", what: "SME; defines requirements; validates model accuracy" },
      { who: "RevOps", what: "Project coordinator; technical consultant; builds components" },
      { who: "Data team", what: "Leads build vs. buy; builds pipelines and Omni reporting" },
    ],
    success: "Accurate, actionable revenue reporting per practice (including phone calls). The model deduplicates touches and distinguishes organic from paid, with visibility in Omni and Practice Accelerator.",
    dependsOn: [], openItems: ["No baseline metric or target defined", "No effort estimate in source doc"],
    impact: 5, effort: 5, status: "Scoping",
    docUrl: "https://docs.google.com/document/d/1GsYge03ApJeKyBRr4yHkRBgkaBF5Ts6oMKbjnmIDCW0/edit",
  },
  {
    id: "ms-02", code: "MS-02", title: "Media Management Platform",
    workstream: "Marketing Services", stakeholder: "Marketing Services (Paid Media)",
    revopsRole: "Project coordinator; technical consultant; supports vendor evaluation",
    devResources: "Contractors (ClickUp workflows — v1 interim)",
    contractors: [
      { name: "Empty Cup Digital", scope: "HubSpot components + platform integration", status: "Engaged" },
      { name: "ClickUp Contractor", scope: "v1 paid media workflows", status: "TBD" },
    ],
    teams: ["Marketing Services", "RevOps"],
    problem: "The paid media team spends a disproportionate amount of time on manual configuration — building and updating ads across platforms, making spend decisions without dedicated tooling, and operating across disconnected systems. Client campaigns historically run under a shared “Moxie HQ” account, which is increasingly problematic for platform compliance and forces manual naming conventions for per-client billing and reporting.",
    solution: "Stand up ClickUp-based workflows as an interim v1 to structure paid media campaign management while a greenfield media management platform is evaluated and selected. Full implementation includes per-client account separation. Long-term platform effectiveness depends on the multi-touch attribution model as a prerequisite.",
    deliverables: [
      { text: "ClickUp workflows for paid media campaign management (v1 interim)", stretch: false },
      { text: "Vendor evaluation and selection led by Marketing Services", stretch: false },
      { text: "Net-new media management platform implemented and live", stretch: false },
      { text: "Moxie HQ separated into per-client accounts within the platform", stretch: false },
    ],
    roles: [
      { who: "Marketing Services", what: "SME; defines requirements; leads vendor evaluation and selection" },
      { who: "RevOps", what: "Coordinator; supports vendor evaluation; manages implementation and contractors" },
      { who: "ClickUp Contractor (TBD)", what: "Build v1 ClickUp paid media workflows" },
      { who: "Empty Cup Digital", what: "HubSpot components + integration of new platform" },
    ],
    success: "ClickUp v1 workflows live as interim; selected platform live with per-client separation before end of year. Materially reduced manual ad configuration; platform used for spend optimization decisions.",
    dependsOn: [{ id: "ms-01", type: "hard", note: "Long-term platform effectiveness requires attribution model" }],
    openItems: ["ClickUp contractor unsourced", "“Materially reduced” not baselined"],
    impact: 4, effort: 4, status: "Scoping",
    docUrl: "https://docs.google.com/document/d/1-d96qB8HMYBhoMEJbxapKYp4vcBLYFyhWufX1MLr_ac/edit",
  },
  {
    id: "ms-03", code: "MS-03", title: "AI-Powered Creative Production Workflow",
    workstream: "Marketing Services", stakeholder: "Marketing Services (Paid Media)",
    revopsRole: "Project coordinator + business systems build", devResources: "Product (AI PM)",
    contractors: [{ name: "ClickUp Contractor", scope: "Integration and workflow build", status: "TBD" }],
    teams: ["Marketing Services", "RevOps", "Product"],
    problem: "Ad creative production is highly manual — creatives are built in Canva or CapCut, downloaded, uploaded to FileCamp for approval, then re-uploaded to Google Drive and each ad platform individually. Simple templating means creatives overlap across customers, limiting campaign effectiveness across Meta Ads, Google Ads, SMS, and other channels.",
    solution: "Build a Claude-powered creative production workflow integrated with existing tools (Canva, FileCamp, Google Drive, Meta Ads Library) to cut manual effort and produce more differentiated creatives at scale. Designed to ship independently — not blocked by the media platform or attribution — while getting more effective as those come online.",
    deliverables: [
      { text: "Claude-powered creative generation and templating workflow", stretch: false },
      { text: "Integrations with existing tools to remove manual upload/download steps", stretch: false },
      { text: "Cross-channel coverage: Meta Ads, Google Ads, SMS, other visual/copy channels", stretch: false },
      { text: "Foundation that can ingest attribution + media platform signals over time", stretch: false },
    ],
    roles: [
      { who: "Marketing Services", what: "SME; Jenn + Christina lead requirements and own operations; Kennedy adds SME input as she onboards" },
      { who: "RevOps", what: "Coordinator; builds business system components; manages contractors" },
      { who: "Product (AI PM)", what: "Leads AI-powered workflow implementation" },
      { who: "ClickUp Contractor (TBD)", what: "ClickUp integration and workflow build" },
    ],
    success: "Creative team produces more differentiated ad creatives across all paid channels in meaningfully less time, with reduced manual file handling — on a foundation that can absorb attribution and media platform inputs as those mature.",
    dependsOn: [
      { id: "ms-01", type: "soft", note: "Performance signals improve creative iteration" },
      { id: "ms-02", type: "soft", note: "Platform outputs feed the workflow over time" },
    ],
    openItems: ["ClickUp contractor unsourced", "“Meaningfully less time” not baselined"],
    impact: 4, effort: 3, status: "Scoping",
    docUrl: "https://docs.google.com/document/d/1yA_N8OraJ6k4nykuuTcHB-GzHIkBPj-hS-imGM2QQZ8/edit",
  },
  {
    id: "ms-04", code: "MS-04", title: "Meta Ads Segment-Based Service Gating",
    workstream: "Marketing Services", stakeholder: "Marketing Services (Paid Media)",
    revopsRole: "Project coordinator + business systems build", devResources: "N/A",
    contractors: [
      { name: "Empty Cup Digital", scope: "HubSpot form access configuration", status: "Engaged" },
      { name: "ClickUp Contractor", scope: "Workflow warnings", status: "TBD" },
    ],
    teams: ["Marketing Services", "RevOps"],
    problem: "Meta Ads service eligibility rules exist in policy but are not enforced by systems, allowing customers and PSMs to submit requests for services their segment doesn’t qualify for. This creates invalid campaign requests, internal escalations, and inconsistent service delivery.",
    solution: "Define a segment-to-service eligibility matrix for Meta Ads aligned to the new segmentation framework (Growth, Silver, Gold, Platinum, Diamond, VIP), then enforce it via HubSpot form access restrictions gated by segment field and ClickUp workflow warnings on related campaign tasks.",
    deliverables: [
      { text: "Segment-to-service eligibility matrix for Meta Ads", stretch: false },
      { text: "HubSpot form access restrictions based on segment field", stretch: false },
      { text: "ClickUp workflow warnings for ineligible or edge-case requests", stretch: false },
    ],
    roles: [
      { who: "Marketing Services", what: "SME; Jenn leads initial eligibility matrix; Johanna approves and owns rules ongoing" },
      { who: "RevOps", what: "Coordinator; builds HubSpot + ClickUp enforcement logic; manages contractors" },
      { who: "Empty Cup Digital", what: "HubSpot form access configuration" },
      { who: "ClickUp Contractor (TBD)", what: "ClickUp workflow warnings" },
    ],
    success: "Customers and PSMs are technically unable to submit Meta Ads requests outside their segment’s eligibility — invalid requests are blocked or flagged at the system level before reaching the Meta Ads team.",
    dependsOn: [], openItems: ["ClickUp contractor unsourced", "Assumes segment field is populated and current in HubSpot"],
    impact: 3, effort: 2, status: "Scoping",
    docUrl: "https://docs.google.com/document/d/1zQ3YtDxSBPbZGktWV9iQf8cCFWHoCmivrfQQCl2EHKc/edit",
  },
  {
    id: "sup-01", code: "SUP-01", title: "Account Setup & Visibility",
    workstream: "Supplies", stakeholder: "Supplies team (Shannon Aubert, OAs)",
    revopsRole: "Project coordinator + business systems build",
    devResources: "Engineering (stretch — Moxie Admin automation)",
    contractors: [
      { name: "Empty Cup Digital", scope: "HubSpot object/pipeline build", status: "Engaged" },
      { name: "ClickUp Contractor", scope: "Workflow + integrations", status: "TBD" },
    ],
    teams: ["Supplies", "RevOps", "Engineering"],
    problem: "Account setup and migration runs across HubSpot, Zapier, and a Google Sheet, with no real-time status visibility outside the Supplies team. Providers and PSMs repeatedly ask via Slack and email where an account stands, slowing onboarding and pulling OAs away from setup work. As provider volume grows, this doesn’t scale without headcount.",
    solution: "Migrate the full account setup intake and task lifecycle into ClickUp, with status mirrored into a new HubSpot Supplies Pipeline (backed by a Supplies Accounts custom object). Automated Intercom tickets notify Providers of key milestones so they — and their PSMs — self-serve status.",
    deliverables: [
      { text: "HubSpot Supplies Pipeline + Supplies Accounts custom object (associated with Companies)", stretch: false },
      { text: "ClickUp intake form + task workflow replacing the Google Sheets tracker", stretch: false },
      { text: "HubSpot ↔ ClickUp data sync for PSM visibility during account reviews", stretch: false },
      { text: "ClickUp ↔ Intercom integration — milestone tickets surfacing in Moxie Suite", stretch: false },
      { text: "Moxie Admin enable-ordering trigger (manual handoff first, automation later)", stretch: true },
    ],
    roles: [
      { who: "Supplies team", what: "SME; defines fields, workflow steps, comms content; validates each phase" },
      { who: "RevOps", what: "Coordinator; architects HubSpot + ClickUp structure; manages contractors; writes integration specs" },
      { who: "Engineering", what: "Supports stretch: automated enable-ordering in Moxie Admin" },
      { who: "Contractors", what: "Hands-on ClickUp workflow, HubSpot build, and integrations" },
    ],
    success: "PSMs and Providers find setup status without contacting the Supplies team — Slack status inquiries drop materially within 60 days of launch. OAs work entirely out of ClickUp with no Google Sheets reliance.",
    dependsOn: [], openItems: ["ClickUp contractor unsourced", "Slack-inquiry baseline not yet measured"],
    impact: 4, effort: 3, status: "Scoping",
    docUrl: "https://docs.google.com/document/d/1CHZfRVGsc_8-PqefOWVjlWaJl-ufVpQPHaNn0MNawYY/edit",
  },
  {
    id: "sup-02", code: "SUP-02", title: "Ordering Process Improvements",
    workstream: "Supplies", stakeholder: "Supplies team (Shannon Aubert, OAs)",
    revopsRole: "Project coordinator + business systems build",
    devResources: "Engineering (vendor portal APIs); Data team (stretch)",
    contractors: [{ name: "Contractor", scope: "RevOps-scoped build work", status: "TBD" }],
    teams: ["Supplies", "RevOps", "Engineering", "Data"],
    problem: "OAs manually read order requests and log into individual vendor portals to place orders on Moxie’s internal accounts — highly manual and error-prone, with no systematic task management. Orders get dropped or placed incorrectly, and without automated vendor reporting, fulfillment visibility can’t be surfaced to providers.",
    solution: "Progressively reduce manual ordering work: structured task management built on the SUP-01 ClickUp foundation, then layered vendor portal API integrations to automate order placement. Fulfillment reporting built in Omni from vendor platform data gives the Supplies team — and eventually providers — real-time order status.",
    deliverables: [
      { text: "ClickUp order management workflow — intake, processing, fulfillment tracking (extends SUP-01)", stretch: false },
      { text: "Vendor portal API integrations to automate order placement", stretch: false },
      { text: "Snowflake/Omni fulfillment visibility dashboard", stretch: true },
      { text: "Provider-facing order status via Intercom (extends SUP-01 notification framework)", stretch: false },
    ],
    roles: [
      { who: "Supplies team", what: "SME; defines order workflows, vendor requirements, fulfillment tracking; validates phases" },
      { who: "RevOps", what: "Coordinator; builds ClickUp order workflow; manages contractors" },
      { who: "Engineering", what: "Builds custom API integrations with vendor ordering portals" },
      { who: "Data team", what: "Vendor data pipeline into Snowflake; Omni fulfillment reporting (stretch)" },
    ],
    success: "OAs no longer manually log into vendor portals for routine orders; orders no longer dropped or mis-placed for lack of task structure. Fulfillment status checked from a single dashboard rather than per-vendor.",
    dependsOn: [{ id: "sup-01", type: "hard", note: "Extends SUP-01’s ClickUp + Intercom notification foundation" }],
    openItems: ["Contractor unsourced", "Vendor API feasibility unvalidated per supplier"],
    impact: 4, effort: 4, status: "Scoping",
    docUrl: "https://docs.google.com/document/d/1XshPsvvIIr4RldY2HzvlZmkZOxBdSV24Za-3Wr3mGJU/edit",
  },
  {
    id: "sup-03", code: "SUP-03", title: "Spend & Rebate Reporting",
    workstream: "Supplies", stakeholder: "Supplies team (Shannon Aubert, OAs)",
    revopsRole: "Project coordinator + business systems build", devResources: "Data team (Snowflake, Omni)",
    contractors: [
      { name: "Empty Cup Digital", scope: "HubSpot spend sync + field mapping", status: "Engaged" },
      { name: "ClickUp Contractor", scope: "Rebate review workflow", status: "TBD" },
    ],
    teams: ["Supplies", "RevOps", "Data"],
    problem: "Supplies orders run through a unified Shopify portal, but spend data isn’t connected to rebate targets in any systematic way. No real-time view of spend vs. rebate thresholds, rebate commitments aren’t stored anywhere structured, and spend isn’t tied back to HubSpot for PSM account reviews.",
    solution: "Pull Shopify order data and rebate targets into the Data Warehouse and surface them in an Omni dashboard showing spend progress against thresholds. When spend nears a rebate level, a ClickUp workflow triggers a review to update the Shopify catalog and push over the threshold. Key spend metrics sync back to HubSpot.",
    deliverables: [
      { text: "Shopify → Data Warehouse pipeline (foundation for downstream reporting)", stretch: false },
      { text: "Rebate data structure — negotiated targets and thresholds by supplier", stretch: false },
      { text: "Omni spend & rebate dashboard — spend by supplier, threshold progress, rebate earned vs. projected", stretch: false },
      { text: "Auto-triggered ClickUp rebate review workflow near thresholds", stretch: false },
      { text: "HubSpot spend sync for PSM account visibility", stretch: false },
    ],
    roles: [
      { who: "Supplies team", what: "SME; defines rebate structures, threshold logic, workflow requirements; validates reporting" },
      { who: "RevOps", what: "Coordinator; builds ClickUp workflow and HubSpot sync; manages contractors" },
      { who: "Data team", what: "Shopify pipeline; rebate data model; Omni dashboard" },
      { who: "Empty Cup Digital", what: "HubSpot spend sync build and field mapping" },
      { who: "ClickUp Contractor (TBD)", what: "Rebate review workflow build" },
    ],
    success: "Supplies team sees in real time where spend stands vs. each rebate threshold, with review tasks surfaced automatically. PSMs reference a provider’s spend history directly from HubSpot without contacting the Supplies team.",
    dependsOn: [{ id: "sup-01", type: "soft", note: "HubSpot sync benefits from SUP-01’s Supplies Accounts object" }],
    openItems: ["ClickUp contractor unsourced", "Rebate commitments need structured capture before modeling"],
    impact: 3, effort: 3, status: "Scoping",
    docUrl: "https://docs.google.com/document/d/1l2vdN8YvnIjaKaxWsmwOkF6YSzagoNvUMG8dGhKg2I8/edit",
  },
  {
    id: "ps-01", code: "PS-01", title: "Increase Tier 0 Visibility in Moxie Suite",
    workstream: "Practice Success", stakeholder: "Practice Success",
    revopsRole: "Project coordinator + technical consultant", devResources: "Product",
    contractors: [], teams: ["Practice Success", "RevOps", "Product"],
    problem: "Moxie Concierge is hard for providers to discover and accessible from only limited areas of Moxie Suite, so providers bypass it and contact their PSM directly for questions Concierge could resolve. Those who find it often don’t know what it can handle, requiring trial and error before they find value.",
    solution: "Work with Product to increase Concierge visibility and accessibility across more Moxie Suite pages, making it an obvious resource at any point in a provider’s workflow. Stretch: pre-load Concierge with page-level context at time of access so it’s ready for questions relevant to where the provider is.",
    deliverables: [
      { text: "Increased Concierge visibility and accessibility across Moxie Suite pages", stretch: false },
      { text: "Context-aware Concierge pre-loaded with page-level context at access", stretch: true },
    ],
    roles: [
      { who: "Practice Success", what: "SME; defines visibility and accessibility requirements; leads vendor vetting if applicable" },
      { who: "RevOps", what: "Coordinator; technical consultant; manages requirements handoff to Product" },
      { who: "Product", what: "Owns and executes in-app UI changes to Concierge placement and accessibility" },
    ],
    success: "Provider adoption of Concierge increases meaningfully by usage volume — rollout gated on sufficient Tier 1 support capacity to absorb the expected increase in escalations.",
    dependsOn: [{ id: "external", type: "external", note: "Gated on Tier 1 support capacity (support triage project — not yet documented here)" }],
    openItems: ["Gating project not yet in portfolio", "Concierge usage instrumentation unconfirmed", "“Meaningfully” not baselined"],
    impact: 3, effort: 2, status: "Scoping",
    docUrl: "https://docs.google.com/document/d/1izYcMIkS5Uzu_zay1jU5GM5CkETCgIyhcUv06-D_Qc0/edit",
  },
];

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only. Example: curl -X POST https://<your-app>.vercel.app/api/seed" });
    }
    if (!requireEditKey(req, res)) return;
    const body = parseBody(req);
    const existing = await getProjects();
    if (existing.length > 0 && !body.force) {
      return res.status(409).json({ error: "KV already has data. POST with {\"force\": true} to overwrite." });
    }
    await saveProjects(SEED);
    return res.status(200).json({ ok: true, seeded: SEED.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
