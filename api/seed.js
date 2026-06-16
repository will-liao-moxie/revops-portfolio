import { requireEditKey, parseBody, getProjects, saveProjects } from "./_lib/kv.js";

/* One unified `roles` list per project = all resources, internal + external.
   No status, no effort (size is the single cost measure). */
const SEED = [
  {
    id: "ms-01", code: "MS-01", title: "Multi-Touch Attribution Model",
    workstream: "Marketing Services", stakeholder: "Marketing Services (Paid Media)",
    dri: "", targetWindow: "Q3 2026",
    problem: "Moxie has no unified model linking paid advertising (Meta/Google) to revenue — pipelines only track Meta form submissions and miss primary Google Ads drivers like phone calls. Without it we can't separate organic from paid or see cross-channel patient journeys, so marketing decisions aren't data-backed.",
    solution: "Build a multi-touch attribution architecture that records every interaction (forms, calls, visits, referrals) as a timestamped touchpoint rolling up to bookings, after a Data-led build-vs-buy evaluation.",
    deliverables: [
      { text: "Build vs. buy evaluation (Data / RevOps / Marketing)", stretch: false },
      { text: "Attribution model — touchpoints, logic, 90-day window, Google Ads call tracking", stretch: false },
      { text: "Omni reporting layer", stretch: false },
      { text: "HubSpot + ClickUp sync", stretch: false },
      { text: "Practice Accelerator integration", stretch: true },
    ],
    roles: [
      { who: "Marketing Services", what: "Defines requirements; validates model accuracy" },
      { who: "RevOps", what: "Builds components; technical consultant" },
      { who: "Data team", what: "Leads build vs. buy; builds pipelines and Omni reporting" },
    ],
    success: "Accurate, actionable revenue reporting per practice (including phone calls). The model deduplicates touches and distinguishes organic from paid, with visibility in Omni and Practice Accelerator.",
    dependsOn: [], openItems: ["No effort estimate yet"],
    impact: 5, size: "XL",
  },
  {
    id: "ms-02", code: "MS-02", title: "Media Management Platform",
    workstream: "Marketing Services", stakeholder: "Marketing Services (Paid Media)",
    dri: "", targetWindow: "Q4 2026",
    problem: "The paid media team loses disproportionate time to manual ad configuration across disconnected platforms, with no dedicated tooling for spend decisions. Client campaigns also run under a shared “Moxie HQ” account, blocking clean per-client billing and reporting.",
    solution: "Stand up ClickUp workflows as an interim v1 while a dedicated media management platform is evaluated and selected, with per-client account separation in the full build.",
    deliverables: [
      { text: "ClickUp workflows for paid media campaign management (v1 interim)", stretch: false },
      { text: "Vendor evaluation and selection led by Marketing Services", stretch: false },
      { text: "Net-new media management platform implemented and live", stretch: false },
      { text: "Moxie HQ separated into per-client accounts within the platform", stretch: false },
    ],
    roles: [
      { who: "Marketing Services", what: "Defines requirements; leads vendor evaluation and selection" },
      { who: "RevOps", what: "Supports vendor evaluation; manages implementation" },
      { who: "Empty Cup Digital", what: "HubSpot components + integration of new platform" },
      { who: "ClickUp Contractor", what: "Builds v1 ClickUp paid media workflows" },
    ],
    success: "ClickUp v1 workflows live as interim; selected platform live with per-client separation before end of year. Materially reduced manual ad configuration; platform used for spend optimization decisions.",
    dependsOn: [{ id: "ms-01", note: "Long-term platform effectiveness benefits from the attribution model; the v1 ClickUp build is not blocked by it" }],
    openItems: [],
    impact: 4, size: "L",
  },
  {
    id: "ms-03", code: "MS-03", title: "AI-Powered Creative Production Workflow",
    workstream: "Marketing Services", stakeholder: "Marketing Services (Paid Media)",
    dri: "", targetWindow: "Q4 2026",
    problem: "Ad creative production is highly manual — built in Canva/CapCut, then shuffled by hand through FileCamp, Google Drive, and each ad platform. Thin templating means creatives overlap across customers, capping campaign effectiveness across Meta, Google, and SMS.",
    solution: "Build a Claude-powered creative production workflow wired into existing tools (Canva, FileCamp, Google Drive, Meta Ads Library) to cut manual effort and produce more differentiated creatives at scale — shipping independently of the platform and attribution work.",
    deliverables: [
      { text: "Claude-powered creative generation and templating workflow", stretch: false },
      { text: "Integrations with existing tools to remove manual upload/download steps", stretch: false },
      { text: "Cross-channel coverage: Meta Ads, Google Ads, SMS, other visual/copy channels", stretch: false },
      { text: "Foundation that can ingest attribution + media platform signals over time", stretch: false },
    ],
    roles: [
      { who: "Marketing Services", what: "Jenn + Christina lead requirements and own operations; Kennedy adds SME input as she onboards" },
      { who: "RevOps", what: "Builds business-system components" },
      { who: "Product (AI PM)", what: "Leads AI workflow implementation" },
      { who: "ClickUp Contractor", what: "ClickUp integration and workflow build" },
    ],
    success: "Creative team produces more differentiated ad creatives across all paid channels in meaningfully less time, with reduced manual file handling — on a foundation that can absorb attribution and media platform inputs as those mature.",
    dependsOn: [],
    openItems: [],
    impact: 4, size: "M",
  },
  {
    id: "ms-04", code: "MS-04", title: "Meta Ads Segment-Based Service Gating",
    workstream: "Marketing Services", stakeholder: "Marketing Services (Paid Media)",
    dri: "Johanna Singer", targetWindow: "Q3 2026",
    problem: "Meta Ads service eligibility rules exist in policy but aren't enforced by systems, so customers and PSMs submit requests their segment doesn't qualify for. That creates invalid campaign requests, internal escalations, and inconsistent service delivery.",
    solution: "Define a segment-to-service eligibility matrix for Meta Ads aligned to the new segmentation framework (Growth, Silver, Gold, Platinum, Diamond, VIP), then enforce it via HubSpot form access restrictions gated by segment field and ClickUp workflow warnings.",
    deliverables: [
      { text: "Segment-to-service eligibility matrix for Meta Ads", stretch: false },
      { text: "HubSpot form access restrictions based on segment field", stretch: false },
      { text: "ClickUp workflow warnings for ineligible or edge-case requests", stretch: false },
    ],
    roles: [
      { who: "Marketing Services", what: "Jenn leads initial eligibility matrix; Johanna approves and owns rules ongoing" },
      { who: "RevOps", what: "Builds HubSpot + ClickUp enforcement logic" },
      { who: "Empty Cup Digital", what: "HubSpot form access configuration" },
      { who: "ClickUp Contractor", what: "ClickUp workflow warnings" },
    ],
    success: "Customers and PSMs are technically unable to submit Meta Ads requests outside their segment’s eligibility — invalid requests are blocked or flagged at the system level before reaching the Meta Ads team.",
    dependsOn: [], openItems: ["Assumes segment field is populated and current in HubSpot"],
    impact: 3, size: "S",
  },
  {
    id: "sup-01", code: "SUP-01", title: "Account Setup & Visibility",
    workstream: "Supplies", stakeholder: "Supplies team (Shannon Aubert, OAs)",
    dri: "Shannon Aubert", targetWindow: "Q3 2026",
    problem: "Account setup runs across HubSpot, Zapier, and a Google Sheet, with no real-time status outside the Supplies team — so Providers and PSMs constantly ask via Slack where an account stands. It pulls OAs off setup work and won't scale with provider volume without added headcount.",
    solution: "Migrate the full account-setup intake and task lifecycle into ClickUp, mirrored into a new HubSpot Supplies Pipeline, with automated Intercom milestone tickets so Providers and PSMs self-serve status.",
    deliverables: [
      { text: "HubSpot Supplies Pipeline + Supplies Accounts custom object (associated with Companies)", stretch: false },
      { text: "ClickUp intake form + task workflow replacing the Google Sheets tracker", stretch: false },
      { text: "HubSpot ↔ ClickUp data sync for PSM visibility during account reviews", stretch: false },
      { text: "ClickUp ↔ Intercom integration — milestone tickets surfacing in Moxie Suite", stretch: false },
      { text: "Moxie Admin enable-ordering trigger", stretch: true },
    ],
    roles: [
      { who: "Supplies team", what: "Defines fields, workflow steps, comms content; validates each phase" },
      { who: "RevOps", what: "Architects HubSpot + ClickUp structure; writes integration specs" },
      { who: "Engineering", what: "Supports stretch: automated enable-ordering in Moxie Admin" },
      { who: "Empty Cup Digital", what: "HubSpot object/pipeline build" },
      { who: "ClickUp Contractor", what: "Workflow + integrations" },
    ],
    success: "PSMs and Providers find setup status without contacting the Supplies team — Slack status inquiries drop materially within 60 days of launch. OAs work entirely out of ClickUp with no Google Sheets reliance.",
    dependsOn: [], openItems: [],
    impact: 4, size: "M",
  },
  {
    id: "sup-02", code: "SUP-02", title: "Ordering Process Improvements",
    workstream: "Supplies", stakeholder: "Supplies team (Shannon Aubert, OAs)",
    dri: "Shannon Aubert", targetWindow: "Q4 2026",
    problem: "OAs manually read order requests and log into individual vendor portals to place orders on Moxie’s internal accounts — highly manual and error-prone, with no systematic task management. Orders get dropped or placed incorrectly, and without automated vendor reporting, fulfillment visibility can’t be surfaced to providers.",
    solution: "Progressively reduce manual ordering: structured task management on the SUP-01 ClickUp foundation, then vendor portal API integrations to automate placement, with Omni fulfillment reporting from vendor data.",
    deliverables: [
      { text: "ClickUp order management workflow — intake, processing, fulfillment tracking (extends SUP-01)", stretch: false },
      { text: "Vendor portal API integrations to automate order placement", stretch: false },
      { text: "Snowflake/Omni fulfillment visibility dashboard", stretch: true },
      { text: "Provider-facing order status via Intercom (extends SUP-01 notification framework)", stretch: false },
    ],
    roles: [
      { who: "Supplies team", what: "Defines order workflows, vendor requirements, fulfillment tracking; validates phases" },
      { who: "RevOps", what: "Builds ClickUp order workflow" },
      { who: "Engineering", what: "Builds API integrations with vendor ordering portals" },
      { who: "Data team", what: "Vendor data pipeline into Snowflake; Omni fulfillment reporting (stretch)" },
      { who: "Contractor", what: "RevOps-scoped build work" },
    ],
    success: "OAs no longer manually log into vendor portals for routine orders; orders no longer dropped or mis-placed for lack of task structure. Fulfillment status checked from a single dashboard rather than per-vendor.",
    dependsOn: [{ id: "sup-01", note: "Extends SUP-01’s ClickUp + Intercom notification foundation" }],
    openItems: ["Vendor API feasibility unvalidated per supplier"],
    impact: 4, size: "L",
  },
  {
    id: "sup-03", code: "SUP-03", title: "Spend & Rebate Reporting",
    workstream: "Supplies", stakeholder: "Supplies team (Shannon Aubert, OAs)",
    dri: "Shannon Aubert", targetWindow: "Q4 2026",
    problem: "Supplies orders run through a unified Shopify portal, but spend data isn’t connected to rebate targets in any systematic way. There’s no real-time view of spend vs. rebate thresholds, rebate commitments aren’t stored anywhere structured, and spend isn’t tied back to HubSpot for PSM account reviews.",
    solution: "Pull Shopify orders and rebate targets into the Data Warehouse, surface spend-vs-threshold progress in an Omni dashboard, and auto-trigger a ClickUp review when spend nears a rebate level.",
    deliverables: [
      { text: "Shopify → Data Warehouse pipeline (foundation for downstream reporting)", stretch: false },
      { text: "Rebate data structure — negotiated targets and thresholds by supplier", stretch: false },
      { text: "Omni spend & rebate dashboard — spend by supplier, threshold progress, rebate earned vs. projected", stretch: false },
      { text: "Auto-triggered ClickUp rebate review workflow near thresholds", stretch: false },
      { text: "HubSpot spend sync for PSM account visibility", stretch: false },
    ],
    roles: [
      { who: "Supplies team", what: "Defines rebate structures, threshold logic, workflow requirements; validates reporting" },
      { who: "RevOps", what: "Builds ClickUp workflow and HubSpot sync" },
      { who: "Data team", what: "Shopify pipeline; rebate data model; Omni dashboard" },
      { who: "Empty Cup Digital", what: "HubSpot spend sync build and field mapping" },
      { who: "ClickUp Contractor", what: "Rebate review workflow build" },
    ],
    success: "Supplies team sees in real time where spend stands vs. each rebate threshold, with review tasks surfaced automatically. PSMs reference a provider’s spend history directly from HubSpot without contacting the Supplies team.",
    dependsOn: [],
    openItems: ["Rebate commitments need structured capture before modeling"],
    impact: 3, size: "M",
  },
  {
    id: "ps-01", code: "PS-01", title: "Increase Tier 0 Visibility in Moxie Suite",
    workstream: "Practice Success", stakeholder: "Practice Success",
    dri: "", targetWindow: "Q1 2027",
    problem: "Moxie Concierge is hard for providers to discover and reachable from only limited areas of Moxie Suite, so providers bypass it and contact their PSM for questions Concierge could resolve. Those who find it often don’t know what it handles, taking trial and error before they find value.",
    solution: "Work with Product to increase Concierge visibility and accessibility across more Moxie Suite pages so it’s an obvious resource at any point in a provider’s workflow. Stretch: pre-load Concierge with page-level context at access.",
    deliverables: [
      { text: "Increased Concierge visibility and accessibility across Moxie Suite pages", stretch: false },
      { text: "Context-aware Concierge pre-loaded with page-level context at access", stretch: true },
    ],
    roles: [
      { who: "Practice Success", what: "Defines visibility and accessibility requirements; leads vendor vetting if applicable" },
      { who: "RevOps", what: "Manages requirements handoff to Product" },
      { who: "Product", what: "Owns and executes in-app UI changes to Concierge placement and accessibility" },
    ],
    success: "Provider adoption of Concierge increases meaningfully by usage volume — rollout gated on sufficient Tier 1 support capacity to absorb the expected increase in escalations.",
    dependsOn: [],
    openItems: ["Gating project not yet in portfolio", "Concierge usage instrumentation unconfirmed"],
    impact: 3, size: "S",
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
      return res.status(409).json({ error: "Store already has data. POST with {\"force\": true} to overwrite." });
    }
    await saveProjects(SEED);
    return res.status(200).json({ ok: true, seeded: SEED.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
