const state = {
    apiBase: "local",
    page: 1,
    pageSize: 9,
    totalItems: 0,
    servicesView: "cards",
    servicesGrouped: false,
    tableLimit: "25",
    tableSortKey: "user_contribution_gbp",
    tableSortDir: "desc",
    latestServicesPayload: null,
    latestAllServicesPayload: null,
    latestTax: null,
    latestTaxResponse: null,
    latestBreakdown: null,
    latestFlows: null,
    frontendBundle: null,
    mapMode: "total",
    initialLoadDone: false,
}

const DEFAULT_FORM_STATE = {
    income: "39000",
    region: "England",
    tax_year: "2025-26",
    compare_tax_year: "none",
    council_tax_band: "auto",
    postcode: "",
    council_name: "",
    council_tax_override: "",
    uk_nation_tax: "england_ni",
    employment_type: "employed",
    student_loan_plan: "none",
    savings_interest: "0",
    dividend_income: "0",
    vat_on: "1",
    vat_ratio: "0.6",
    partner_income: "0",
    marriage_allowance: "0",
    pension_salary_sacrifice: "0",
    pension_relief_source: "0",
    gift_aid: "0",
    other_deductions: "0",
    policy_basic_rate: "",
    policy_higher_rate: "",
    policy_ni_main_rate: "",
    policy_vat_rate: "",
}

const palette = [
    "#0f766e",
    "#14b8a6",
    "#2563eb",
    "#0ea5e9",
    "#f97316",
    "#fb7185",
    "#d97706",
    "#0e7490",
    "#ef4444",
    "#7c3aed",
    "#334155",
    "#0891b2",
]

const COUNCIL_TAX_AVERAGE_BY_REGION = {
    "north east": 2345.0,
    "north west": 2280.0,
    "yorkshire and the humber": 2240.0,
    "east midlands": 2310.0,
    "west midlands": 2290.0,
    "east of england": 2440.0,
    london: 2170.0,
    "south east": 2435.0,
    "south west": 2445.0,
    england: 2280.0,
    wales: 2200.0,
    scotland: 1590.0,
    "northern ireland": 1250.0,
}

const COUNCIL_TAX_BAND_MULTIPLIER = {
    A: 6 / 9,
    B: 7 / 9,
    C: 8 / 9,
    D: 1.0,
    E: 11 / 9,
    F: 13 / 9,
    G: 15 / 9,
    H: 18 / 9,
}

const TAX_PARAMS_BY_YEAR = {
    "2023-24": {
        personal_allowance: 12570,
        basic_rate_limit: 37700,
        higher_rate_threshold: 125140,
        basic_rate: 0.2,
        higher_rate: 0.4,
        additional_rate: 0.45,
        ni_primary_threshold: 12570,
        ni_upper_earnings_limit: 50270,
        ni_main_rate: 0.12,
        ni_upper_rate: 0.02,
        vat_rate: 0.2,
    },
    "2024-25": {
        personal_allowance: 12570,
        basic_rate_limit: 37700,
        higher_rate_threshold: 125140,
        basic_rate: 0.2,
        higher_rate: 0.4,
        additional_rate: 0.45,
        ni_primary_threshold: 12570,
        ni_upper_earnings_limit: 50270,
        ni_main_rate: 0.08,
        ni_upper_rate: 0.02,
        vat_rate: 0.2,
    },
    "2025-26": {
        personal_allowance: 12570,
        basic_rate_limit: 37700,
        higher_rate_threshold: 125140,
        basic_rate: 0.2,
        higher_rate: 0.4,
        additional_rate: 0.45,
        ni_primary_threshold: 12570,
        ni_upper_earnings_limit: 50270,
        ni_main_rate: 0.08,
        ni_upper_rate: 0.02,
        vat_rate: 0.2,
    },
}

const STUDENT_LOAN_PLAN = {
    1: [24990.0, 0.09],
    2: [27295.0, 0.09],
    4: [31395.0, 0.09],
    5: [25000.0, 0.09],
    postgrad: [21000.0, 0.06],
}

const FRONTEND_BUNDLE_PATH = "./data/frontend_bundle.json"
const postcodeCache = new Map()

const THEME_KEY = "taxes_theme"

function applyTheme(theme) {
    const root = document.documentElement
    if (theme === "dark") {
        root.setAttribute("data-theme", "dark")
    } else {
        root.removeAttribute("data-theme")
    }
    const toggle = document.getElementById("theme-toggle")
    if (toggle) {
        toggle.setAttribute("data-theme", theme)
        toggle.setAttribute(
            "aria-label",
            `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
        )
        toggle.setAttribute(
            "title",
            `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
        )
    }
}

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === "dark" || saved === "light") {
        applyTheme(saved)
        return
    }
    const preferredDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
    ).matches
    applyTheme(preferredDark ? "dark" : "light")
}

function money(v) {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
    }).format(v)
}

function compactMillionsGBP(millions) {
    if (millions >= 1_000_000) {
        return `${(millions / 1_000_000).toFixed(2)}tn GBP`
    }
    if (millions >= 1_000) {
        return `${(millions / 1_000).toFixed(1)}bn GBP`
    }
    return `${millions.toFixed(0)}m GBP`
}

function setStatus(text) {
    document.getElementById("status").textContent = text
}

function numberFromInput(id, fallback = 0) {
    const raw = document.getElementById(id).value
    if (raw === "" || raw == null) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
}

function parsePolicyOverrides() {
    const basic_rate = numberFromInput("policy-basic-rate", NaN)
    const higher_rate = numberFromInput("policy-higher-rate", NaN)
    const ni_main_rate = numberFromInput("policy-ni-main-rate", NaN)
    const vat_rate = numberFromInput("policy-vat-rate", NaN)
    const out = {}
    if (Number.isFinite(basic_rate)) out.basic_rate = basic_rate
    if (Number.isFinite(higher_rate)) out.higher_rate = higher_rate
    if (Number.isFinite(ni_main_rate)) out.ni_main_rate = ni_main_rate
    if (Number.isFinite(vat_rate)) out.vat_rate = vat_rate
    return Object.keys(out).length ? out : null
}

function buildBasePayload() {
    const annual_income_gbp = Number(
        document.getElementById("annual-income").value,
    )
    const region = document.getElementById("region").value
    const tax_year = document.getElementById("tax-year").value
    const compare_tax_year = document.getElementById("compare-tax-year").value
    const includeVat = document.getElementById("include-vat").checked
    const ratioInput = Number(document.getElementById("vat-ratio").value)
    const vatable_spend_ratio = includeVat ? ratioInput : 0
    const policy_overrides = parsePolicyOverrides()

    const councilOverride = numberFromInput("council-tax-override", NaN)
    return {
        annual_income_gbp,
        region,
        tax_year,
        compare_tax_year,
        council_tax_band: document.getElementById("council-tax-band").value,
        postcode: document.getElementById("postcode").value.trim() || null,
        council_name:
            document.getElementById("council-name").value.trim() || null,
        council_tax_annual_override_gbp: Number.isFinite(councilOverride)
            ? councilOverride
            : null,
        uk_nation_for_income_tax:
            document.getElementById("uk-nation-tax").value,
        employment_type: document.getElementById("employment-type").value,
        student_loan_plan: document.getElementById("student-loan-plan").value,
        savings_interest_gbp: numberFromInput("savings-interest"),
        dividend_income_gbp: numberFromInput("dividend-income"),
        vatable_spend_ratio,
        pension_salary_sacrifice_gbp: numberFromInput(
            "pension-salary-sacrifice",
        ),
        pension_relief_at_source_gbp: numberFromInput("pension-relief-source"),
        gift_aid_gbp: numberFromInput("gift-aid"),
        other_pre_tax_deductions_gbp: numberFromInput("other-deductions"),
        partner_annual_income_gbp: numberFromInput("partner-income"),
        marriage_allowance_transfer:
            document.getElementById("marriage-allowance").checked,
        policy_overrides,
    }
}

function cleanFunctionLabel(label) {
    const trimmed = label.replace(/\s+/g, " ").trim()
    const m = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s+(.*)$/)
    if (!m) return { code: "", name: trimmed }
    return { code: m[1], name: m[2] }
}

const COFOG_CATEGORY = {
    1: "General public services",
    2: "Defence",
    3: "Public order and safety",
    4: "Economic affairs",
    5: "Environment protection",
    6: "Housing and community amenities",
    7: "Health",
    8: "Recreation, culture and religion",
    9: "Education",
    10: "Social protection",
}
const COFOG_MAJOR_BY_CATEGORY = Object.fromEntries(
    Object.entries(COFOG_CATEGORY).map(([k, v]) => [v, k]),
)

function categoryFromCode(code) {
    if (!code) return "Other"
    const major = code.split(".")[0]
    return COFOG_CATEGORY[major] || "Other"
}

function aggregateByCategory(items) {
    const grouped = {}
    items.forEach((s) => {
        const key = s._category || "Other"
        if (!grouped[key]) {
            grouped[key] = {
                function_label: key,
                _name: key,
                _code: COFOG_MAJOR_BY_CATEGORY[key] || "",
                _category: key,
                user_contribution_gbp: 0,
                share_of_user_tax_percent: 0,
                spending_amount_m_gbp: 0,
            }
        }
        grouped[key].user_contribution_gbp += s.user_contribution_gbp
        grouped[key].share_of_user_tax_percent += s.share_of_user_tax_percent
        grouped[key].spending_amount_m_gbp += s.spending_amount_m_gbp
    })
    return Object.values(grouped)
}

function sortServices(items) {
    const key = state.tableSortKey
    const dir = state.tableSortDir === "asc" ? 1 : -1
    return [...items].sort((a, b) => {
        if (key === "name") return a._name.localeCompare(b._name) * dir
        if (key === "code")
            return (a._code || "").localeCompare(b._code || "") * dir
        return (a[key] - b[key]) * dir
    })
}

async function post(path, body) {
    const base = (state.apiBase || "").trim().toLowerCase()
    if (!base || base === "local") {
        return localPost(path, body)
    }
    const r = await fetch(`${state.apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(`${path} failed (${r.status})`)
    return r.json()
}

function round2(v) {
    return Math.round(v * 100) / 100
}

function getTaxParams(taxYear) {
    return TAX_PARAMS_BY_YEAR[taxYear] || TAX_PARAMS_BY_YEAR["2025-26"]
}

function estimateIncomeTaxWithReliefs(annualIncome, p, extension = 0) {
    const taper = Math.max(0, annualIncome - 100000) / 2
    const personalAllowance = Math.max(0, p.personal_allowance - taper)
    const taxable = Math.max(0, annualIncome - personalAllowance)
    const effectiveBasic = Math.max(0, p.basic_rate_limit + extension)
    const basicTaxable = Math.min(taxable, effectiveBasic)
    const higherWidth = Math.max(
        0,
        p.higher_rate_threshold - personalAllowance - effectiveBasic,
    )
    const higherTaxable = Math.min(
        Math.max(0, taxable - effectiveBasic),
        higherWidth,
    )
    const additionalTaxable = Math.max(0, taxable - basicTaxable - higherTaxable)
    return round2(
        basicTaxable * p.basic_rate +
            higherTaxable * p.higher_rate +
            additionalTaxable * p.additional_rate,
    )
}

function estimateIncomeTaxScotland(annualIncome, p) {
    const taper = Math.max(0, annualIncome - 100000) / 2
    const personalAllowance = Math.max(0, p.personal_allowance - taper)
    let remaining = Math.max(0, annualIncome - personalAllowance)
    const bands = [
        [2306, 0.19],
        [13991 - 2306, 0.2],
        [31092 - 13991, 0.21],
        [62943 - 31092, 0.42],
    ]
    let total = 0
    for (const [width, rate] of bands) {
        const take = Math.min(remaining, width)
        if (take <= 0) break
        total += take * rate
        remaining -= take
    }
    if (remaining > 0) total += remaining * 0.47
    return round2(total)
}

function estimateNationalInsurance(annualIncome, p) {
    if (annualIncome <= p.ni_primary_threshold) return 0
    if (annualIncome <= p.ni_upper_earnings_limit) {
        return round2((annualIncome - p.ni_primary_threshold) * p.ni_main_rate)
    }
    const main =
        (p.ni_upper_earnings_limit - p.ni_primary_threshold) * p.ni_main_rate
    const upper = (annualIncome - p.ni_upper_earnings_limit) * p.ni_upper_rate
    return round2(main + upper)
}

function estimateSelfEmployedNI(annualIncome) {
    const class2 = annualIncome >= 12570 ? 179.4 : 0
    const class4main = Math.max(0, Math.min(annualIncome, 50270) - 12570) * 0.06
    const class4upper = Math.max(0, annualIncome - 50270) * 0.02
    return round2(class2 + class4main + class4upper)
}

function estimateVat(annualIncome, incomeTax, ni, ratio, p) {
    const disposable = Math.max(0, annualIncome - incomeTax - ni)
    const vatable = disposable * ratio
    return round2(vatable * (p.vat_rate / (1 + p.vat_rate)))
}

function estimateCouncilTax(region, band = "auto") {
    const key = String(region || "England").trim().toLowerCase()
    const base = COUNCIL_TAX_AVERAGE_BY_REGION[key] ?? COUNCIL_TAX_AVERAGE_BY_REGION.england
    const b = String(band || "auto").toUpperCase()
    if (b === "AUTO") return round2(base)
    const mult = COUNCIL_TAX_BAND_MULTIPLIER[b]
    return round2(mult ? base * mult : base)
}

function estimateSavingsTax(annualIncome, savings) {
    if (!savings) return 0
    let allowance = 1000
    let rate = 0.2
    if (annualIncome > 50270 && annualIncome <= 125140) {
        allowance = 500
        rate = 0.4
    } else if (annualIncome > 125140) {
        allowance = 0
        rate = 0.45
    }
    return round2(Math.max(0, savings - allowance) * rate)
}

function estimateDividendTax(annualIncome, dividends) {
    if (!dividends) return 0
    const taxable = Math.max(0, dividends - 500)
    const rate =
        annualIncome <= 50270 ? 0.0875 : annualIncome <= 125140 ? 0.3375 : 0.3935
    return round2(taxable * rate)
}

function estimateStudentLoan(annualIncome, plan) {
    if (!plan || plan === "none") return 0
    const [threshold, rate] = STUDENT_LOAN_PLAN[plan] || [1e9, 0]
    return round2(Math.max(0, annualIncome - threshold) * rate)
}

async function lookupPostcode(postcode) {
    const p = String(postcode || "").trim()
    if (!p) return null
    if (postcodeCache.has(p)) return postcodeCache.get(p)
    try {
        const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(p)}`)
        if (!r.ok) return null
        const j = await r.json()
        const out = {
            postcode: j?.result?.postcode || p,
            council_name: j?.result?.admin_district || "",
            region: j?.result?.region || "",
            country: j?.result?.country || "",
        }
        postcodeCache.set(p, out)
        return out
    } catch {
        return null
    }
}

async function ensureFrontendBundle() {
    if (state.frontendBundle) return state.frontendBundle
    const r = await fetch(FRONTEND_BUNDLE_PATH, { cache: "no-store" })
    if (!r.ok) throw new Error(`Failed to load ${FRONTEND_BUNDLE_PATH}`)
    state.frontendBundle = await r.json()
    return state.frontendBundle
}

function paginate(items, page, pageSize) {
    const start = (page - 1) * pageSize
    return [items.slice(start, start + pageSize), items.length]
}

async function localTaxEstimate(req) {
    const result = await localTaxEstimateCore(req)
    const compareYear = req.compare_tax_year || "none"
    if (compareYear !== "none" && compareYear !== req.tax_year) {
        const cmp = await localTaxEstimateCore({
            ...req,
            tax_year: compareYear,
            compare_tax_year: "none",
        })
        const delta = round2(cmp.total_estimated_tax_gbp - result.total_estimated_tax_gbp)
        result.historical_comparison = {
            compare_tax_year: compareYear,
            total_estimated_tax_gbp: cmp.total_estimated_tax_gbp,
            delta_vs_selected_gbp: delta,
            delta_vs_selected_percent: round2(
                result.total_estimated_tax_gbp
                    ? (delta / result.total_estimated_tax_gbp) * 100
                    : 0,
            ),
        }
    }
    return result
}

async function localTaxEstimateCore(req) {
    const p = {
        ...getTaxParams(req.tax_year || "2025-26"),
        ...(req.policy_overrides || {}),
    }
    const adjustedIncome = Math.max(
        0,
        (req.annual_income_gbp || 0) -
            (req.pension_salary_sacrifice_gbp || 0) -
            (req.other_pre_tax_deductions_gbp || 0),
    )
    const adjustedPartner = Math.max(0, req.partner_annual_income_gbp || 0)
    const extension =
        (req.pension_relief_at_source_gbp || 0) + (req.gift_aid_gbp || 0)

    let primaryIncomeTax =
        req.uk_nation_for_income_tax === "scotland"
            ? estimateIncomeTaxScotland(adjustedIncome, p)
            : estimateIncomeTaxWithReliefs(adjustedIncome, p, extension)
    let primaryNI =
        req.employment_type === "self_employed" || req.employment_type === "mixed"
            ? estimateSelfEmployedNI(adjustedIncome)
            : estimateNationalInsurance(adjustedIncome, p)
    let partnerIncomeTax = estimateIncomeTaxWithReliefs(adjustedPartner, p, 0)
    let partnerNI = estimateNationalInsurance(adjustedPartner, p)

    let marriageCredit = 0
    if (req.marriage_allowance_transfer && adjustedPartner > 0) {
        const lower = Math.min(adjustedIncome, adjustedPartner)
        const higher = Math.max(adjustedIncome, adjustedPartner)
        if (lower <= p.personal_allowance && higher <= p.higher_rate_threshold) {
            marriageCredit = Math.min(252, Math.max(primaryIncomeTax, partnerIncomeTax))
            if (primaryIncomeTax >= partnerIncomeTax) {
                primaryIncomeTax = round2(primaryIncomeTax - marriageCredit)
            } else {
                partnerIncomeTax = round2(partnerIncomeTax - marriageCredit)
            }
        }
    }

    const householdIncomeTax = round2(primaryIncomeTax + partnerIncomeTax)
    const householdNI = round2(primaryNI + partnerNI)
    const adjustedHousehold = adjustedIncome + adjustedPartner
    const vatRatio = req.vatable_spend_ratio ?? 0.6
    const vat = estimateVat(adjustedHousehold, householdIncomeTax, householdNI, vatRatio, p)

    const postcodeData = req.postcode ? await lookupPostcode(req.postcode) : null
    const inferredRegion = postcodeData?.region || ""
    const inferredCouncil = req.council_name || postcodeData?.council_name || ""
    const councilRegion = inferredRegion || req.region || "England"
    const council =
        req.council_tax_annual_override_gbp != null
            ? round2(req.council_tax_annual_override_gbp)
            : estimateCouncilTax(councilRegion, req.council_tax_band || "auto")

    const savingsTax = estimateSavingsTax(adjustedIncome, req.savings_interest_gbp || 0)
    const dividendTax = estimateDividendTax(adjustedIncome, req.dividend_income_gbp || 0)
    const studentLoan = estimateStudentLoan(adjustedIncome, req.student_loan_plan || "none")

    const total = round2(
        householdIncomeTax + householdNI + vat + council + savingsTax + dividendTax + studentLoan,
    )
    const gross = (req.annual_income_gbp || 0) + (req.partner_annual_income_gbp || 0)
    const effective = gross ? total / gross : 0
    const takeHome = round2(gross - total)

    const vatLow = Math.max(0, vatRatio - 0.1)
    const vatHigh = Math.min(1, vatRatio + 0.1)
    const vatEstLow = estimateVat(adjustedHousehold, householdIncomeTax, householdNI, vatLow, p)
    const vatEstHigh = estimateVat(adjustedHousehold, householdIncomeTax, householdNI, vatHigh, p)
    const councilLow =
        req.council_tax_annual_override_gbp != null ? council : round2(council * 0.9)
    const councilHigh =
        req.council_tax_annual_override_gbp != null ? council : round2(council * 1.1)

    return {
        annual_income_gbp: round2(req.annual_income_gbp || 0),
        income_tax_gbp: householdIncomeTax,
        national_insurance_gbp: householdNI,
        vat_estimate_gbp: vat,
        council_tax_estimate_gbp: council,
        student_loan_repayment_gbp: studentLoan,
        savings_tax_gbp: savingsTax,
        dividend_tax_gbp: dividendTax,
        total_estimated_tax_gbp: total,
        effective_tax_rate: effective,
        assumptions: {
            tax_year: req.tax_year || "2025-26",
            vatable_spend_ratio: vatRatio,
            vat_rate: p.vat_rate,
            ni_main_rate: p.ni_main_rate,
            ni_upper_rate: p.ni_upper_rate,
            adjusted_income_gbp: round2(adjustedIncome),
            adjusted_partner_income_gbp: round2(adjustedPartner),
            pension_salary_sacrifice_gbp: req.pension_salary_sacrifice_gbp || 0,
            pension_relief_at_source_gbp: req.pension_relief_at_source_gbp || 0,
            gift_aid_gbp: req.gift_aid_gbp || 0,
            other_pre_tax_deductions_gbp: req.other_pre_tax_deductions_gbp || 0,
            council_tax_band: req.council_tax_band || "auto",
            council_name: inferredCouncil,
            postcode_lookup_region: inferredRegion,
            council_tax_region_used: councilRegion,
            uk_nation_for_income_tax: req.uk_nation_for_income_tax || "england_ni",
            employment_type: req.employment_type || "employed",
            student_loan_plan: req.student_loan_plan || "none",
            policy_simulation_active: req.policy_overrides ? "yes" : "no",
            marriage_allowance_credit_gbp: marriageCredit,
        },
        household_summary: {
            household_income_gbp: round2(gross),
            partner_annual_income_gbp: round2(req.partner_annual_income_gbp || 0),
            household_adults: (req.partner_annual_income_gbp || 0) > 0 ? 2 : 1,
            marriage_allowance_transfer: !!req.marriage_allowance_transfer,
        },
        take_home_gbp: takeHome,
        uncertainty_range_gbp: {
            low: round2(
                householdIncomeTax +
                    householdNI +
                    vatEstLow +
                    councilLow +
                    savingsTax +
                    dividendTax +
                    studentLoan,
            ),
            high: round2(
                householdIncomeTax +
                    householdNI +
                    vatEstHigh +
                    councilHigh +
                    savingsTax +
                    dividendTax +
                    studentLoan,
            ),
        },
        historical_comparison: null,
    }
}

async function localSpendingBreakdown(req) {
    const tax = await localTaxEstimate(req)
    const bundle = await ensureFrontendBundle()
    const userShare =
        tax.total_estimated_tax_gbp / 1_000_000 / bundle.total_uk_revenue_m_gbp
    const services = bundle.services
        .map((s) => {
            const contribution = s.spending_amount_m_gbp * userShare * 1_000_000
            return {
                function_label: s.function_label,
                spending_amount_m_gbp: round2(s.spending_amount_m_gbp),
                user_contribution_gbp: round2(contribution),
                share_of_user_tax_percent: round2(
                    tax.total_estimated_tax_gbp
                        ? (contribution / tax.total_estimated_tax_gbp) * 100
                        : 0,
                ),
            }
        })
        .sort((a, b) => b.user_contribution_gbp - a.user_contribution_gbp)
    const topN = req.top_n ?? 12
    return {
        total_uk_tax_revenue_m_gbp: bundle.total_uk_revenue_m_gbp,
        user_total_tax_gbp: tax.total_estimated_tax_gbp,
        user_share_of_total_revenue: userShare,
        spending_year: bundle.meta.spending_year,
        revenue_year: bundle.meta.revenue_year,
        services: services.slice(0, topN),
    }
}

async function localServicesImpact(req) {
    const tax = await localTaxEstimate(req)
    const bundle = await ensureFrontendBundle()
    const userShare =
        tax.total_estimated_tax_gbp / 1_000_000 / bundle.total_uk_revenue_m_gbp
    const all = bundle.services
        .map((s) => {
            const contribution = s.spending_amount_m_gbp * userShare * 1_000_000
            return {
                function_label: s.function_label,
                spending_amount_m_gbp: round2(s.spending_amount_m_gbp),
                user_contribution_gbp: round2(contribution),
                share_of_user_tax_percent: round2(
                    tax.total_estimated_tax_gbp
                        ? (contribution / tax.total_estimated_tax_gbp) * 100
                        : 0,
                ),
            }
        })
        .sort((a, b) => b.user_contribution_gbp - a.user_contribution_gbp)
    const page = req.page ?? 1
    const pageSize = req.page_size ?? 20
    const [items, totalItems] = paginate(all, page, pageSize)
    return {
        total_uk_tax_revenue_m_gbp: bundle.total_uk_revenue_m_gbp,
        user_total_tax_gbp: tax.total_estimated_tax_gbp,
        user_share_of_total_revenue: userShare,
        spending_year: bundle.meta.spending_year,
        revenue_year: bundle.meta.revenue_year,
        page,
        page_size: pageSize,
        total_items: totalItems,
        services: items,
    }
}

async function localRegionalFlows(req) {
    const bundle = await ensureFrontendBundle()
    const regional = bundle.regional
    const page = req.page ?? 1
    const pageSize = req.page_size ?? 50
    const [paged, totalItems] = paginate(regional.flows, page, pageSize)
    const official = regional.official_borrowing || {}
    return {
        year: regional.year,
        page,
        page_size: pageSize,
        total_items: totalItems,
        official_borrowing_b_gbp: official.amount_b_gbp ?? null,
        official_borrowing_year_label: official.reference_period ?? null,
        official_borrowing_release_period: official.release_period ?? null,
        official_borrowing_reference_period: official.reference_period ?? null,
        borrowing_method: official.amount_b_gbp
            ? "official_psnb_ex"
            : "implied_gap_from_regional_dataset",
        balances: regional.balances,
        flows: paged,
    }
}

function rowsToCsv(rows, fieldnames) {
    const lines = [fieldnames.join(",")]
    rows.forEach((r) => {
        lines.push(
            fieldnames
                .map((k) => {
                    const v = r[k] ?? ""
                    const s = String(v)
                    return s.includes(",") ? `"${s.replaceAll('"', '""')}"` : s
                })
                .join(","),
        )
    })
    return `${lines.join("\n")}\n`
}

async function localJournalistExport(req) {
    const tax = await localTaxEstimate(req)
    const breakdown = await localSpendingBreakdown({ ...req, top_n: 12 })
    const services = await localServicesImpact({ ...req, page: 1, page_size: 100 })
    const regional = await localRegionalFlows({ year: "2022 to 2023", page: 1, page_size: 200 })
    return {
        exported_at_utc: new Date().toISOString(),
        tax,
        spending_breakdown: breakdown,
        services_impact: services,
        regional_flows: regional,
        services_csv: rowsToCsv(services.services, [
            "function_label",
            "spending_amount_m_gbp",
            "user_contribution_gbp",
            "share_of_user_tax_percent",
        ]),
        regional_balances_csv: rowsToCsv(regional.balances, [
            "geography_code",
            "geography_name",
            "contribution_m_gbp",
            "spending_m_gbp",
            "net_balance_m_gbp",
        ]),
    }
}

async function localPost(path, body) {
    switch (path) {
        case "/tax/estimate":
            return localTaxEstimate(body || {})
        case "/spending/breakdown":
            return localSpendingBreakdown(body || {})
        case "/services/impact":
            return localServicesImpact(body || {})
        case "/regional/flows":
            return localRegionalFlows(body || {})
        case "/journalist/export":
            return localJournalistExport(body || {})
        default:
            throw new Error(`Unsupported local endpoint: ${path}`)
    }
}

function renderMetrics(tax, breakdown) {
    const directTax = tax.income_tax_gbp + tax.national_insurance_gbp
    const vatEnabled = (tax.assumptions?.vatable_spend_ratio ?? 0) > 0
    const metrics = [
        ["Direct tax (income tax + NI)", money(directTax)],
        [
            vatEnabled
                ? "Total incl. VAT + council tax"
                : "Total incl. council tax (VAT off)",
            money(tax.total_estimated_tax_gbp),
        ],
        ["Effective tax rate", `${(tax.effective_tax_rate * 100).toFixed(1)}%`],
        [
            "UK total revenue",
            compactMillionsGBP(breakdown.total_uk_tax_revenue_m_gbp),
        ],
        [
            "Your revenue share",
            `${(breakdown.user_share_of_total_revenue * 100).toFixed(6)}%`,
        ],
        [
            "Likely total-tax range",
            tax.uncertainty_range_gbp
                ? `${money(tax.uncertainty_range_gbp.low)} - ${money(tax.uncertainty_range_gbp.high)}`
                : "n/a",
        ],
    ]
    const root = document.getElementById("metric-grid")
    root.innerHTML = metrics
        .map(
            ([label, value]) => `
      <div class="metric">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
      </div>`,
        )
        .join("")
}

function renderHistoricalComparison(tax) {
    const root = document.getElementById("historical-compare")
    const cmp = tax.historical_comparison
    if (!cmp) {
        root.style.display = "none"
        root.textContent = ""
        return
    }
    const deltaSign = cmp.delta_vs_selected_gbp >= 0 ? "+" : ""
    root.style.display = "block"
    root.innerHTML = `
      <strong>Year comparison</strong>
      <div>Selected year total: ${money(tax.total_estimated_tax_gbp)}</div>
      <div>${cmp.compare_tax_year} total: ${money(cmp.total_estimated_tax_gbp)}</div>
      <div>Delta: ${deltaSign}${money(cmp.delta_vs_selected_gbp)} (${deltaSign}${cmp.delta_vs_selected_percent.toFixed(2)}%)</div>
    `
}

function renderTakeHomeView(tax, payload) {
    const gross =
        Number(payload.annual_income_gbp || 0) +
        Number(payload.partner_annual_income_gbp || 0)
    const rows = [
        ["Gross income", gross, "#0f766e"],
        ["Income tax", -tax.income_tax_gbp, "#be123c"],
        ["National insurance", -tax.national_insurance_gbp, "#b45309"],
    ]
    if (payload.student_loan_plan && payload.student_loan_plan !== "none") {
        rows.push(["Student loan", -(tax.student_loan_repayment_gbp || 0), "#7c2d12"])
    }
    if (
        Number(payload.savings_interest_gbp || 0) > 0 ||
        Number(payload.dividend_income_gbp || 0) > 0
    ) {
        rows.push([
            "Savings/dividend tax",
            -((tax.savings_tax_gbp || 0) + (tax.dividend_tax_gbp || 0)),
            "#7c3aed",
        ])
    }
    if (Number(payload.vatable_spend_ratio || 0) > 0) {
        rows.push(["VAT estimate", -tax.vat_estimate_gbp, "#0369a1"])
    }
    rows.push(["Council tax", -tax.council_tax_estimate_gbp, "#334155"])
    rows.push([
        "Estimated take-home",
        tax.take_home_gbp || gross - tax.total_estimated_tax_gbp,
        "#166534",
    ])
    const max = Math.max(...rows.map((r) => Math.abs(r[1])), 1)
    const root = document.getElementById("take-home-view")
    root.innerHTML = rows
        .map(
            ([k, v, color]) => `
        <div class="take-home-row">
          <div class="k">${k}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(Math.abs(v) / max) * 100}%;background:${color}"></div></div>
          <div class="v">${money(v)}</div>
        </div>`,
        )
        .join("")
}

function renderDataVintage(tax, breakdown, flowsPayload) {
    const officialRelease =
        flowsPayload.official_borrowing_release_period || "Not available"
    const officialReference =
        flowsPayload.official_borrowing_reference_period ||
        flowsPayload.official_borrowing_year_label ||
        "Not available"
    const borrowingMethod =
        flowsPayload.borrowing_method === "official_psnb_ex"
            ? "Official ONS PSNB ex"
            : "Implied from regional revenue/spending"
    const items = [
        [
            "Tax model rates",
            `UK tax year ${tax.assumptions?.tax_year || "2025-26"}`,
        ],
        [
            "National spending allocation",
            `HM Treasury spending year ${breakdown.spending_year}`,
        ],
        [
            "Regional revenue baseline",
            `ONS regional receipts year ${breakdown.revenue_year}`,
        ],
        [
            "Official borrowing series",
            `${borrowingMethod} (release ${officialRelease}, reference ${officialReference})`,
        ],
        ["Page loaded", new Date().toLocaleString()],
    ]

    const root = document.getElementById("data-vintage")
    root.innerHTML = `
      ${items
          .map(
              ([k, v]) => `
        <div class="vintage-item">
          <div class="k">${k}</div>
          <div class="v">${v}</div>
        </div>`,
          )
          .join("")}
      <div class="vintage-warning">
        This tool uses snapshot datasets and may be out of date in future years. Always check the source year labels above before interpreting results.
      </div>
    `
}

function renderPie(services, userTotalTax) {
    const minSlicePct = 3.5
    const maxSlices = 8
    const sorted = [...services].sort(
        (a, b) => b.share_of_user_tax_percent - a.share_of_user_tax_percent,
    )
    const totalServicePct = sorted.reduce(
        (a, s) => a + s.share_of_user_tax_percent,
        0,
    )
    const unattributedPct = Math.max(0, 100 - totalServicePct)

    const all = []
    let otherServicesPct = 0
    let otherServicesAmount = 0
    sorted.forEach((s) => {
        const pct = Number(s.share_of_user_tax_percent || 0)
        if (pct >= minSlicePct && all.length < maxSlices) {
            all.push({ ...s })
            return
        }
        otherServicesPct += pct
        otherServicesAmount += Number(s.user_contribution_gbp || 0)
    })
    const everythingElsePct = Math.max(0, otherServicesPct + unattributedPct)
    if (everythingElsePct > 0.01) {
        all.push({
            function_label: "Other services",
            user_contribution_gbp:
                otherServicesAmount + (userTotalTax * unattributedPct) / 100,
            share_of_user_tax_percent: everythingElsePct,
            _other_services_pct: otherServicesPct,
            _unattributed_pct: unattributedPct,
        })
    }

    const pie = document.getElementById("pie")
    pie.innerHTML = `<svg viewBox="0 0 160 160" class="pie-svg"></svg><div id="pie-tip" class="pie-tip"></div>`
    const svg = pie.querySelector("svg")
    const tip = document.getElementById("pie-tip")
    const showLeaderLabels = (pie.clientWidth || 0) >= 430

    let startAngle = -Math.PI / 2
    const cx = 80
    const cy = 80
    const outerR = 54
    const innerR = 31
    const labelCandidates = []
    all.forEach((s, i) => {
        const share = s.share_of_user_tax_percent / 100
        const sweep = Math.max(share * Math.PI * 2, 0.0001)
        const endAngle = startAngle + sweep
        const x1o = cx + outerR * Math.cos(startAngle)
        const y1o = cy + outerR * Math.sin(startAngle)
        const x2o = cx + outerR * Math.cos(endAngle)
        const y2o = cy + outerR * Math.sin(endAngle)
        const x2i = cx + innerR * Math.cos(endAngle)
        const y2i = cy + innerR * Math.sin(endAngle)
        const x1i = cx + innerR * Math.cos(startAngle)
        const y1i = cy + innerR * Math.sin(startAngle)
        const largeArc = sweep > Math.PI ? 1 : 0
        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
        )
        path.setAttribute(
            "d",
            `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1i} ${y1i} Z`,
        )
        path.setAttribute("fill", palette[i % palette.length])
        path.setAttribute("stroke", "#ffffff")
        path.setAttribute("stroke-width", "1")
        path.style.cursor = "pointer"

        const { name } = cleanFunctionLabel(s.function_label)
        const label = name
        const pct = s.share_of_user_tax_percent.toFixed(1)
        const isEverythingElse = s.function_label === "Other services"
        const breakdown = isEverythingElse
            ? ` • small services ${(s._other_services_pct || 0).toFixed(1)}%, unattributed ${(s._unattributed_pct || 0).toFixed(1)}%`
            : ""
        path.addEventListener("mousemove", (e) => {
            tip.style.display = "block"
            tip.style.left = `${e.offsetX + 10}px`
            tip.style.top = `${e.offsetY - 8}px`
            tip.textContent = `${label}: ${money(s.user_contribution_gbp)} (${pct}%)${breakdown}`
        })
        path.addEventListener("mouseleave", () => {
            tip.style.display = "none"
        })
        svg.appendChild(path)
        const midAngle = startAngle + sweep / 2
        if (!isEverythingElse && Number(pct) >= 8) {
            labelCandidates.push({
                name,
                pct,
                angle: midAngle,
                x: cx + Math.cos(midAngle) * outerR,
                y: cy + Math.sin(midAngle) * outerR,
            })
        }
        startAngle = endAngle
    })

    if (showLeaderLabels) {
        const sides = {
            right: labelCandidates
                .filter((c) => c.x >= cx)
                .sort((a, b) => a.y - b.y),
            left: labelCandidates
                .filter((c) => c.x < cx)
                .sort((a, b) => a.y - b.y),
        }
        const minGap = 7
        ;["left", "right"].forEach((side) => {
            const items = sides[side]
            let prevY = 26
            items.forEach((item) => {
                const elbowR = outerR + 8
                const elbowX = cx + Math.cos(item.angle) * elbowR
                const elbowYRaw = cy + Math.sin(item.angle) * elbowR
                const elbowY = Math.max(prevY + minGap, Math.min(134, elbowYRaw))
                prevY = elbowY
                const labelX = side === "right" ? 148 : 12
                const labelAnchor = side === "right" ? "start" : "end"
                const hBend = side === "right" ? labelX - 2 : labelX + 2
                const line = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "path",
                )
                line.setAttribute(
                    "d",
                    `M ${item.x} ${item.y} L ${elbowX} ${elbowY} L ${hBend} ${elbowY}`,
                )
                line.setAttribute("class", "pie-leader")
                svg.appendChild(line)

                const txt = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "text",
                )
                txt.setAttribute("x", `${labelX}`)
                txt.setAttribute("y", `${elbowY - 0.6}`)
                txt.setAttribute("text-anchor", labelAnchor)
                txt.setAttribute("class", "pie-leader-label")
                txt.textContent = `${item.name}: ${item.pct}%`
                svg.appendChild(txt)
            })
        })
    }

    const hole = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    hole.setAttribute("cx", `${cx}`)
    hole.setAttribute("cy", `${cy}`)
    hole.setAttribute("r", `${innerR - 1}`)
    hole.setAttribute("fill", "var(--surface)")
    hole.setAttribute("stroke", "var(--line)")
    hole.setAttribute("stroke-width", "1")
    svg.appendChild(hole)

    const centerValue = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
    )
    centerValue.setAttribute("x", `${cx}`)
    centerValue.setAttribute("y", `${cy - 2}`)
    centerValue.setAttribute("text-anchor", "middle")
    centerValue.setAttribute("font-size", "8")
    centerValue.setAttribute("font-weight", "900")
    centerValue.setAttribute("fill", "var(--text)")
    centerValue.textContent = money(userTotalTax)
    svg.appendChild(centerValue)

    const centerLabel = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
    )
    centerLabel.setAttribute("x", `${cx}`)
    centerLabel.setAttribute("y", `${cy + 13}`)
    centerLabel.setAttribute("text-anchor", "middle")
    centerLabel.setAttribute("font-size", "4.8")
    centerLabel.setAttribute("font-weight", "600")
    centerLabel.setAttribute("fill", "var(--text-muted)")
    centerLabel.textContent = "total annual tax"
    svg.appendChild(centerLabel)

    const legend = document.getElementById("pie-legend")
    if (legend) legend.innerHTML = ""
}

function renderServiceCards(payload) {
    state.latestServicesPayload = payload

    const view = state.servicesView
    const grouped = state.servicesGrouped
    const root = document.getElementById("service-cards")
    root.classList.toggle("table-mode", view === "table")
    const prevBtn = document.getElementById("prev-services")
    const nextBtn = document.getElementById("next-services")
    const pageLabel = document.getElementById("services-page")

    const useAllData =
        (view === "table" || grouped) && state.latestAllServicesPayload
    const sourcePayload = useAllData ? state.latestAllServicesPayload : payload
    let services = sourcePayload.services.map((s) => {
        const parsed = cleanFunctionLabel(s.function_label)
        return {
            ...s,
            _code: parsed.code,
            _name: parsed.name,
            _category: categoryFromCode(parsed.code),
        }
    })

    if (view === "table") {
        state.totalItems = services.length
    } else if (grouped) {
        state.totalItems = services.length
        pageLabel.textContent = "Grouped totals"
        prevBtn.disabled = true
        nextBtn.disabled = true
    } else {
        state.totalItems = payload.total_items
        pageLabel.textContent = `Page ${payload.page} of ${Math.max(1, Math.ceil(payload.total_items / payload.page_size))}`
        prevBtn.disabled = false
        nextBtn.disabled = false
    }

    if (grouped) services = aggregateByCategory(services)

    const groups = grouped
        ? [{ title: "Category totals", items: services }]
        : [{ title: "", items: services }]

    if (view === "table") {
        const rowsSorted = sortServices(services)
        const limit =
            state.tableLimit === "all"
                ? rowsSorted.length
                : Number(state.tableLimit)
        const safeLimit = Math.max(1, limit)
        const pages = Math.max(1, Math.ceil(rowsSorted.length / safeLimit))
        state.page = Math.min(Math.max(1, state.page), pages)
        const start = (state.page - 1) * safeLimit
        const end = Math.min(start + safeLimit, rowsSorted.length)
        const rowsShown = rowsSorted.slice(start, end)
        pageLabel.textContent =
            state.tableLimit === "all"
                ? `Table • all ${rowsSorted.length} rows`
                : `Table page ${state.page}/${pages} • rows ${start + 1}-${end} of ${rowsSorted.length}`
        prevBtn.disabled = state.tableLimit === "all" || state.page <= 1
        nextBtn.disabled = state.tableLimit === "all" || state.page >= pages
        const sortArrow = (k) =>
            state.tableSortKey === k
                ? state.tableSortDir === "asc"
                    ? " ▲"
                    : " ▼"
                : ""
        root.innerHTML = groups
            .map((g) => {
                const head = g.title
                    ? `<div class="group-title">${g.title}</div>`
                    : ""
                const rows = rowsShown
                    .map(
                        (s) => `
            <tr>
              <td>${s._name}</td>
              <td>${s._code || "-"}</td>
              <td>${money(s.user_contribution_gbp)}</td>
              <td>${s.share_of_user_tax_percent.toFixed(2)}%</td>
              <td>${compactMillionsGBP(s.spending_amount_m_gbp)}</td>
            </tr>`,
                    )
                    .join("")
                return `
          <div class="service-group">
            ${head}
            <div class="table-wrap">
              <table class="services-table">
                <thead>
                  <tr>
                    <th data-sort="name">Service${sortArrow("name")}</th>
                    <th data-sort="code" title="COFOG = Classification of the Functions of Government, an international system for classifying government spending by function.">COFOG${sortArrow("code")}</th>
                    <th data-sort="user_contribution_gbp">Your contribution${sortArrow("user_contribution_gbp")}</th>
                    <th data-sort="share_of_user_tax_percent">Share of tax${sortArrow("share_of_user_tax_percent")}</th>
                    <th data-sort="spending_amount_m_gbp">National spend${sortArrow("spending_amount_m_gbp")}</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>`
            })
            .join("")
        return
    }

    root.innerHTML = groups
        .map((g) => {
            const head = g.title
                ? `<div class="group-title">${g.title}</div>`
                : ""
            const cards = g.items
                .map((s) => {
                    const codeBadge = s._code
                        ? `<span class="code-badge">COFOG ${s._code}</span>`
                        : ""
                    return `
            <article class="card">
              <div class="card-head">
                <div class="title">${s._name}</div>
                ${codeBadge}
              </div>
              <div class="amount">${money(s.user_contribution_gbp)}</div>
              <div class="meta">
                <div><strong>${s.share_of_user_tax_percent.toFixed(2)}%</strong> of your total tax</div>
                <div><strong>${compactMillionsGBP(s.spending_amount_m_gbp)}</strong> national spend</div>
              </div>
            </article>`
                })
                .join("")
            return `<div class="service-group">${head}<div class="service-cards-grid">${cards}</div></div>`
        })
        .join("")
}

function renderRegionalMap(balances, mode = "total") {
    const isPerCapita = mode === "per_capita"
    const populationByRegion =
        state.frontendBundle?.regional?.population_by_region || {}
    const values = balances.map((b) => {
        if (!isPerCapita) return b.net_balance_m_gbp
        const pop = Number(populationByRegion[b.geography_name])
        if (!Number.isFinite(pop) || pop <= 0) return null
        return (b.net_balance_m_gbp * 1_000_000) / pop
    })
    const max = Math.max(
        ...values.map((v) => (Number.isFinite(v) ? Math.abs(v) : 0)),
        1,
    )
    const valueByRegion = new Map(
        balances.map((b, idx) => [b.geography_name, values[idx]]),
    )
    const layout = {
        Scotland: [2, 0],
        "North West": [2, 2],
        "North East": [3, 2],
        "Yorkshire and The Humber": [3, 3],
        "East Midlands": [3, 4],
        "West Midlands": [2, 4],
        Wales: [1, 4],
        "East of England": [4, 4],
        London: [4, 5],
        "South East": [4, 6],
        "South West": [2, 6],
        "Northern Ireland": [0, 3],
    }
    const root = document.getElementById("uk-map")
    const isNarrow = (root.clientWidth || 0) < 560
    const labelLinesByRegion = isNarrow
        ? {
              "Yorkshire and The Humber": ["Yorks", "& Humber"],
              "East of England": ["East of", "England"],
              "Northern Ireland": ["N. Ireland"],
              "West Midlands": ["W. Midlands"],
              "East Midlands": ["E. Midlands"],
              "South West": ["South West"],
              "South East": ["South East"],
              "North West": ["North West"],
              "North East": ["North East"],
          }
        : {
              "Yorkshire and The Humber": ["Yorkshire", "& Humber"],
              "East of England": ["East of", "England"],
              "Northern Ireland": ["N. Ireland"],
              "West Midlands": ["West", "Midlands"],
              "East Midlands": ["East", "Midlands"],
              "South West": ["South West"],
              "South East": ["South East"],
              "North West": ["North West"],
              "North East": ["North East"],
          }
    const dx = isNarrow ? 68 : 112
    const dy = isNarrow ? 66 : 92
    const hexR = isNarrow ? 32 : 42
    const padX = isNarrow ? 38 : 82
    const padY = isNarrow ? 26 : 42
    const width = isNarrow ? 430 : 760
    const height = isNarrow ? 500 : 655
    root.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="UK regional redistribution hex cartogram"></svg>`
    const svg = root.querySelector("svg")
    const ns = "http://www.w3.org/2000/svg"
    const defs = document.createElementNS(ns, "defs")
    const shadow = document.createElementNS(ns, "filter")
    shadow.setAttribute("id", "hexShadow")
    shadow.setAttribute("x", "-20%")
    shadow.setAttribute("y", "-20%")
    shadow.setAttribute("width", "140%")
    shadow.setAttribute("height", "140%")
    const blur = document.createElementNS(ns, "feDropShadow")
    blur.setAttribute("dx", "0")
    blur.setAttribute("dy", "1.2")
    blur.setAttribute("stdDeviation", "1.2")
    blur.setAttribute("flood-color", "rgba(15,23,42,0.22)")
    shadow.appendChild(blur)
    defs.appendChild(shadow)
    svg.appendChild(defs)

    Object.entries(layout).forEach(([region, [col, row]]) => {
        const balance = balances.find((b) => b.geography_name === region)
        if (!balance) return
        const displayValue = valueByRegion.get(region)
        const hasValue = Number.isFinite(displayValue)
        const ratio = hasValue ? Math.abs(displayValue) / max : 0
        const color =
            !hasValue
                ? "rgba(100, 116, 139, 0.25)"
                : displayValue >= 0
                  ? `rgba(13, 148, 136, ${0.34 + ratio * 0.56})`
                  : `rgba(244, 63, 94, ${0.32 + ratio * 0.56})`
        const valueText = isPerCapita
            ? hasValue
                ? `${displayValue >= 0 ? "+" : ""}${money(displayValue)}`
                : "n/a"
            : `${balance.net_balance_m_gbp >= 0 ? "+" : ""}£${(balance.net_balance_m_gbp / 1000).toFixed(1)}bn`
        const cx = padX + col * dx + (row % 2 ? dx / 2 : 0)
        const cy = padY + row * dy
        const points = Array.from({ length: 6 })
            .map((_, i) => {
                const a = (Math.PI / 180) * (60 * i - 30)
                return `${(cx + hexR * Math.cos(a)).toFixed(1)},${(cy + hexR * Math.sin(a)).toFixed(1)}`
            })
            .join(" ")

        const g = document.createElementNS(ns, "g")
        g.setAttribute("class", "hex-node")
        const hex = document.createElementNS(ns, "polygon")
        hex.setAttribute("points", points)
        hex.setAttribute("fill", color)
        hex.setAttribute("stroke", "rgba(255,255,255,0.86)")
        hex.setAttribute("stroke-width", "1.4")
        hex.setAttribute("filter", "url(#hexShadow)")
        g.appendChild(hex)

        const lines = labelLinesByRegion[region] || [region]
        const name = document.createElementNS(ns, "text")
        name.setAttribute("x", `${cx}`)
        name.setAttribute("text-anchor", "middle")
        name.setAttribute("class", "hex-label")
        const nameStartY = lines.length > 1 ? cy - (isNarrow ? 10 : 12) : cy - (isNarrow ? 6 : 7)
        lines.forEach((line, idx) => {
            const t = document.createElementNS(ns, "tspan")
            t.setAttribute("x", `${cx}`)
            t.setAttribute("y", `${nameStartY + idx * (isNarrow ? 10 : 11)}`)
            t.textContent = line
            name.appendChild(t)
        })
        g.appendChild(name)

        const val = document.createElementNS(ns, "text")
        val.setAttribute("x", `${cx}`)
        val.setAttribute("y", `${cy + (isNarrow ? 14 : 18)}`)
        val.setAttribute("text-anchor", "middle")
        val.setAttribute("class", "hex-value")
        val.textContent =
            isPerCapita && hasValue ? `${valueText}/res` : valueText
        g.appendChild(val)

        const title = document.createElementNS(ns, "title")
        title.textContent = `${region}: ${isPerCapita ? `${valueText} per resident` : valueText}`
        g.appendChild(title)
        svg.appendChild(g)
    })
}

function renderBorrowingContext(tax, flowsPayload) {
    const balances = flowsPayload.balances || []
    const totalRevenueM = balances.reduce((a, b) => a + b.contribution_m_gbp, 0)
    const totalSpendingM = balances.reduce((a, b) => a + b.spending_m_gbp, 0)
    const impliedBorrowingM = Math.max(0, totalSpendingM - totalRevenueM)
    const officialBorrowingM =
        flowsPayload.official_borrowing_b_gbp != null
            ? Number(flowsPayload.official_borrowing_b_gbp) * 1000
            : null
    const borrowingM =
        officialBorrowingM != null ? officialBorrowingM : impliedBorrowingM
    const borrowingPctRevenue =
        totalRevenueM > 0 ? (borrowingM / totalRevenueM) * 100 : 0
    const borrowingPctSpending =
        totalSpendingM > 0 ? (borrowingM / totalSpendingM) * 100 : 0
    const userBorrowShareGBP =
        totalRevenueM > 0
            ? borrowingM *
              1_000_000 *
              (tax.total_estimated_tax_gbp / (totalRevenueM * 1_000_000))
            : 0
    const userTaxsToFundBorrowing =
        borrowingM > 0
            ? (borrowingM * 1_000_000) / tax.total_estimated_tax_gbp
            : 0

    const metrics = [
        ["Estimated UK borrowing (year)", compactMillionsGBP(borrowingM)],
        ["Borrowing vs revenue", `${borrowingPctRevenue.toFixed(1)}%`],
        ["Borrowing vs spending", `${borrowingPctSpending.toFixed(1)}%`],
        [
            `Your implied share of borrowing <span class="help-dot" title="Your estimated share of UK tax revenue multiplied by UK borrowing. This is an allocation metric, not a direct personal debt bill.">i</span>`,
            money(userBorrowShareGBP),
        ],
    ]
    const metricRoot = document.getElementById("borrowing-metrics")
    metricRoot.innerHTML = metrics
        .map(
            ([k, v]) => `
      <div class="borrow-card">
        <div class="k">${k}</div>
        <div class="v">${v}</div>
      </div>`,
        )
        .join("")

    const max = Math.max(totalRevenueM, totalSpendingM, borrowingM, 1)
    const bars = [
        ["Revenue", totalRevenueM, "#0f766e"],
        ["Spending", totalSpendingM, "#b45309"],
        ["Borrowing gap", borrowingM, "#be123c"],
    ]
    const barsRoot = document.getElementById("borrowing-bars")
    barsRoot.innerHTML = `
    ${bars
        .map(
            ([label, value, color]) => `
        <div class="bar-row">
          <div class="label">${label}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%;background:${color}"></div></div>
          <div class="value">${compactMillionsGBP(value)}</div>
        </div>`,
        )
        .join("")}
    <div class="muted" style="margin-top:6px;">
      About ${userTaxsToFundBorrowing.toLocaleString(undefined, { maximumFractionDigits: 0 })} people with your estimated total-tax profile would sum to one year of this borrowing gap.
    </div>
    <div class="muted" style="margin-top:6px;">
      ${
          officialBorrowingM != null
              ? `Using official ONS PSNB ex: release ${
                    flowsPayload.official_borrowing_release_period || "unknown"
                }, reference ${
                    flowsPayload.official_borrowing_reference_period ||
                    flowsPayload.official_borrowing_year_label ||
                    "unknown"
                } (${Number(flowsPayload.official_borrowing_b_gbp).toFixed(1)}bn GBP).`
              : "Using implied borrowing gap from regional revenue vs expenditure totals."
      }
    </div>
    <div class="muted" style="margin-top:2px;">
      “Your implied share of borrowing” = your share of UK tax revenue × UK borrowing.
    </div>
  `
}

function getSankeyTip() {
    let tip = document.getElementById("sankey-tip")
    if (tip) return tip
    tip = document.createElement("div")
    tip.id = "sankey-tip"
    tip.className = "sankey-tip"
    document.body.appendChild(tip)
    return tip
}

function renderSankey(flows, balances) {
    const svg = document.getElementById("sankey")
    const allFlows = flows
    const donors = balances
        .filter((b) => b.net_balance_m_gbp > 0)
        .sort((a, b) => b.net_balance_m_gbp - a.net_balance_m_gbp)
    const recips = balances
        .filter((b) => b.net_balance_m_gbp < 0)
        .sort((a, b) => a.net_balance_m_gbp - b.net_balance_m_gbp)

    const width = Math.max(320, svg.clientWidth || 900)
    const isNarrow = width < 560
    const h = isNarrow ? 500 : 420
    const donorStep = h / (donors.length + 1)
    const recipStep = h / (recips.length + 1)

    const donorY = new Map(
        donors.map((d, i) => [d.geography_name, donorStep * (i + 1)]),
    )
    const recipY = new Map(
        recips.map((r, i) => [r.geography_name, recipStep * (i + 1)]),
    )

    const maxFlow = Math.max(...allFlows.map((f) => f.value_m_gbp), 1)
    const css = getComputedStyle(document.documentElement)
    const sankeyBg = css.getPropertyValue("--surface").trim() || "#ffffff"
    const sankeyText = css.getPropertyValue("--text").trim() || "#1f2937"
    const leftLabelX = Math.max(8, width * 0.02)
    const leftFlowX = Math.max(52, width * (isNarrow ? 0.19 : 0.14))
    const rightFlowX = Math.max(
        leftFlowX + 120,
        width * (isNarrow ? 0.67 : 0.82),
    )
    const rightLabelX = width - (isNarrow ? 4 : 10)
    const c1 = width * (isNarrow ? 0.36 : 0.34)
    const c2 = width * (isNarrow ? 0.52 : 0.62)
    const labelFont = isNarrow ? "10" : "12"
    const shortRegionName = (name) => {
        if (!isNarrow) return name
        const map = {
            "Yorkshire and The Humber": "Yorks & Humber",
            "Northern Ireland": "N. Ireland",
            "East of England": "East England",
            "West Midlands": "W. Midlands",
            "East Midlands": "E. Midlands",
        }
        return map[name] || name
    }
    svg.innerHTML = ""
    svg.setAttribute("viewBox", `0 0 ${width} ${h}`)
    const ns = "http://www.w3.org/2000/svg"

    const regionColor = new Map()
    balances.forEach((b, i) => {
        regionColor.set(b.geography_name, palette[i % palette.length])
    })

    const bg = document.createElementNS(ns, "rect")
    bg.setAttribute("x", "0")
    bg.setAttribute("y", "0")
    bg.setAttribute("width", `${width}`)
    bg.setAttribute("height", `${h}`)
    bg.setAttribute("fill", sankeyBg)
    svg.appendChild(bg)

    const defs = document.createElementNS(ns, "defs")
    svg.appendChild(defs)

    const nodeBarW = width < 560 ? 10 : 13
    const nodeBarH = width < 560 ? 11 : 14

    const nodeTextEls = new Map()
    donors.forEach((d) => {
        const y = donorY.get(d.geography_name) || 0
        const node = document.createElementNS(ns, "rect")
        node.setAttribute("x", `${leftFlowX - nodeBarW / 2}`)
        node.setAttribute("y", `${y - nodeBarH / 2}`)
        node.setAttribute("width", `${nodeBarW}`)
        node.setAttribute("height", `${nodeBarH}`)
        node.setAttribute("rx", "4")
        node.setAttribute("fill", regionColor.get(d.geography_name) || "#64748b")
        node.setAttribute("opacity", "0.95")
        svg.appendChild(node)

        const text = document.createElementNS(ns, "text")
        text.setAttribute("x", `${leftLabelX}`)
        text.setAttribute("y", `${y + 4}`)
        text.setAttribute("font-size", labelFont)
        text.setAttribute("font-weight", "700")
        text.setAttribute("fill", sankeyText)
        text.textContent = shortRegionName(d.geography_name)
        svg.appendChild(text)
        nodeTextEls.set(d.geography_name, text)
    })
    recips.forEach((r) => {
        const y = recipY.get(r.geography_name) || 0
        const node = document.createElementNS(ns, "rect")
        node.setAttribute("x", `${rightFlowX - nodeBarW / 2}`)
        node.setAttribute("y", `${y - nodeBarH / 2}`)
        node.setAttribute("width", `${nodeBarW}`)
        node.setAttribute("height", `${nodeBarH}`)
        node.setAttribute("rx", "4")
        node.setAttribute("fill", regionColor.get(r.geography_name) || "#64748b")
        node.setAttribute("opacity", "0.95")
        svg.appendChild(node)

        const text = document.createElementNS(ns, "text")
        text.setAttribute("x", `${rightLabelX}`)
        text.setAttribute("y", `${y + 4}`)
        text.setAttribute("font-size", labelFont)
        text.setAttribute("font-weight", "700")
        text.setAttribute("text-anchor", "end")
        text.setAttribute("fill", sankeyText)
        text.textContent = shortRegionName(r.geography_name)
        svg.appendChild(text)
        nodeTextEls.set(r.geography_name, text)
    })

    const linkEls = []
    allFlows.forEach((f, i) => {
        const y1 = donorY.get(f.origin_region)
        const y2 = recipY.get(f.destination_region)
        if (!y1 || !y2) return
        const width = Math.max(
            isNarrow ? 0.9 : 1.25,
            0.5 + (f.value_m_gbp / maxFlow) * (isNarrow ? 9 : 14),
        )
        const cFrom = regionColor.get(f.origin_region) || palette[i % palette.length]
        const cTo =
            regionColor.get(f.destination_region) || palette[(i + 4) % palette.length]
        const gradId = `flow-${i}`
        const grad = document.createElementNS(ns, "linearGradient")
        grad.setAttribute("id", gradId)
        grad.setAttribute("x1", `${leftFlowX}`)
        grad.setAttribute("y1", `${y1}`)
        grad.setAttribute("x2", `${rightFlowX}`)
        grad.setAttribute("y2", `${y2}`)
        const stop1 = document.createElementNS(ns, "stop")
        stop1.setAttribute("offset", "0%")
        stop1.setAttribute("stop-color", cFrom)
        const stop2 = document.createElementNS(ns, "stop")
        stop2.setAttribute("offset", "100%")
        stop2.setAttribute("stop-color", cTo)
        grad.appendChild(stop1)
        grad.appendChild(stop2)
        defs.appendChild(grad)
        const path = document.createElementNS(ns, "path")
        path.setAttribute(
            "d",
            `M${leftFlowX},${y1} C${c1},${y1} ${c2},${y2} ${rightFlowX},${y2}`,
        )
        path.setAttribute("fill", "none")
        path.setAttribute("stroke", `url(#${gradId})`)
        path.setAttribute("stroke-width", `${width}`)
        path.setAttribute("stroke-opacity", "0.68")
        path.style.cursor = "pointer"
        path.dataset.origin = f.origin_region
        path.dataset.destination = f.destination_region
        path.dataset.value = String(f.value_m_gbp)
        svg.appendChild(path)
        linkEls.push(path)
    })

    const tip = getSankeyTip()
    const resetEmphasis = () => {
        linkEls.forEach((el) => {
            el.setAttribute("stroke-opacity", "0.68")
        })
        nodeTextEls.forEach((el) => {
            el.setAttribute("opacity", "1")
        })
        tip.style.display = "none"
    }

    linkEls.forEach((el) => {
        el.addEventListener("mousemove", (e) => {
            const origin = el.dataset.origin
            const dest = el.dataset.destination
            const value = Number(el.dataset.value || "0")
            linkEls.forEach((p) => {
                const connected =
                    p.dataset.origin === origin &&
                    p.dataset.destination === dest
                p.setAttribute("stroke-opacity", connected ? "0.92" : "0.12")
            })
            nodeTextEls.forEach((t, name) => {
                t.setAttribute(
                    "opacity",
                    name === origin || name === dest ? "1" : "0.28",
                )
            })
            tip.style.display = "block"
            tip.style.left = `${e.clientX + 14}px`
            tip.style.top = `${e.clientY + 14}px`
            tip.textContent = `${origin} → ${dest}: ${value.toFixed(1)}m GBP`
        })
        el.addEventListener("mouseleave", resetEmphasis)
    })

    svg.addEventListener("mouseleave", resetEmphasis)
}

async function runModel() {
    state.apiBase = "local"
    const basePayload = buildBasePayload()
    setStatus("Computing tax model and loading charts...")

    const [tax, breakdown, impact, allServices, flows] = await Promise.all([
        post("/tax/estimate", basePayload),
        post("/spending/breakdown", { ...basePayload, top_n: 12 }),
        post("/services/impact", {
            ...basePayload,
            page: state.page,
            page_size: state.pageSize,
        }),
        post("/services/impact", { ...basePayload, page: 1, page_size: 100 }),
        post("/regional/flows", {
            year: "2022 to 2023",
            page: 1,
            page_size: 50,
        }),
    ])

    state.latestTax = basePayload
    state.latestTaxResponse = tax
    state.latestBreakdown = breakdown
    state.latestFlows = flows
    state.latestAllServicesPayload = allServices

    renderMetrics(tax, breakdown)
    renderHistoricalComparison(tax)
    renderTakeHomeView(tax, basePayload)
    renderDataVintage(tax, breakdown, flows)
    renderPie(allServices.services, tax.total_estimated_tax_gbp)
    renderServiceCards(impact)
    renderRegionalMap(flows.balances, state.mapMode)
    renderBorrowingContext(tax, flows)
    renderSankey(flows.flows, flows.balances)
    const trust = document.getElementById("trust-last-verified")
    if (trust)
        trust.textContent = `Last verified: ${new Date().toLocaleString()}`
    syncShareUI()
    setStatus("Loaded.")
}

async function loadServicesPage(nextPage) {
    if (state.servicesView === "table") {
        state.page = Math.max(1, nextPage)
        if (state.latestServicesPayload)
            renderServiceCards(state.latestServicesPayload)
        return
    }
    if (state.servicesGrouped) return
    if (!state.latestTax) return
    const maxPage = Math.max(1, Math.ceil(state.totalItems / state.pageSize))
    if (nextPage < 1 || nextPage > maxPage) return
    state.page = nextPage
    const payload = await post("/services/impact", {
        ...state.latestTax,
        page: state.page,
        page_size: state.pageSize,
    })
    renderServiceCards(payload)
}

function buildStateUrl() {
    const current = {
        income: document.getElementById("annual-income").value,
        region: document.getElementById("region").value,
        tax_year: document.getElementById("tax-year").value,
        compare_tax_year: document.getElementById("compare-tax-year").value,
        council_tax_band: document.getElementById("council-tax-band").value,
        postcode: document.getElementById("postcode").value,
        council_name: document.getElementById("council-name").value,
        council_tax_override: document.getElementById("council-tax-override")
            .value,
        uk_nation_tax: document.getElementById("uk-nation-tax").value,
        employment_type: document.getElementById("employment-type").value,
        student_loan_plan: document.getElementById("student-loan-plan").value,
        savings_interest: document.getElementById("savings-interest").value,
        dividend_income: document.getElementById("dividend-income").value,
        vat_on: document.getElementById("include-vat").checked ? "1" : "0",
        vat_ratio: document.getElementById("vat-ratio").value,
        partner_income: document.getElementById("partner-income").value,
        marriage_allowance: document.getElementById("marriage-allowance")
            .checked
            ? "1"
            : "0",
        pension_salary_sacrifice: document.getElementById(
            "pension-salary-sacrifice",
        ).value,
        pension_relief_source: document.getElementById("pension-relief-source")
            .value,
        gift_aid: document.getElementById("gift-aid").value,
        other_deductions: document.getElementById("other-deductions").value,
        policy_basic_rate: document.getElementById("policy-basic-rate").value,
        policy_higher_rate: document.getElementById("policy-higher-rate").value,
        policy_ni_main_rate: document.getElementById("policy-ni-main-rate")
            .value,
        policy_vat_rate: document.getElementById("policy-vat-rate").value,
    }
    const p = new URLSearchParams()
    Object.entries(current).forEach(([k, v]) => {
        if (v !== DEFAULT_FORM_STATE[k]) p.set(k, v)
    })
    const q = p.toString()
    return `${window.location.origin}${window.location.pathname}${q ? `?${q}` : ""}`
}

function buildShareUrl() {
    return `${window.location.origin}${window.location.pathname}`
}

function updateAddressBar() {
    // Privacy mode: do not write inputs/assumptions into browser history.
}

function syncShareUI() {
    const url = buildShareUrl()
    updateAddressBar()
    const text = "I mapped my UK tax footprint with Where Your Taxes Go."
    const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    const li = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(`${text} ${url}`)}`
    document.getElementById("share-x").href = x
    document.getElementById("share-linkedin").href = li
}

function applyQueryParamsToForm() {
    const p = new URLSearchParams(window.location.search)
    const setIf = (id, key) => {
        const v = p.get(key)
        if (v !== null) document.getElementById(id).value = v
    }
    setIf("annual-income", "income")
    setIf("region", "region")
    setIf("tax-year", "tax_year")
    setIf("compare-tax-year", "compare_tax_year")
    setIf("council-tax-band", "council_tax_band")
    setIf("postcode", "postcode")
    setIf("council-name", "council_name")
    setIf("council-tax-override", "council_tax_override")
    setIf("uk-nation-tax", "uk_nation_tax")
    setIf("employment-type", "employment_type")
    setIf("student-loan-plan", "student_loan_plan")
    setIf("savings-interest", "savings_interest")
    setIf("dividend-income", "dividend_income")
    setIf("vat-ratio", "vat_ratio")
    setIf("partner-income", "partner_income")
    setIf("pension-salary-sacrifice", "pension_salary_sacrifice")
    setIf("pension-relief-source", "pension_relief_source")
    setIf("gift-aid", "gift_aid")
    setIf("other-deductions", "other_deductions")
    setIf("policy-basic-rate", "policy_basic_rate")
    setIf("policy-higher-rate", "policy_higher_rate")
    setIf("policy-ni-main-rate", "policy_ni_main_rate")
    setIf("policy-vat-rate", "policy_vat_rate")
    const vatOn = p.get("vat_on")
    if (vatOn !== null)
        document.getElementById("include-vat").checked = vatOn === "1"
    const ma = p.get("marriage_allowance")
    if (ma !== null)
        document.getElementById("marriage-allowance").checked = ma === "1"
}

function downloadTextFile(name, content, type = "text/plain") {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

document.getElementById("tax-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    try {
        state.page = 1
        await runModel()
    } catch (err) {
        setStatus(`Error: ${err.message}`)
    }
})

document
    .getElementById("prev-services")
    .addEventListener("click", () => loadServicesPage(state.page - 1))
document
    .getElementById("next-services")
    .addEventListener("click", () => loadServicesPage(state.page + 1))
document
    .getElementById("services-view")
    .addEventListener("change", async (e) => {
        state.servicesView = e.target.value
        state.page = 1
        const limitEl = document.getElementById("table-limit")
        const isTable = state.servicesView === "table"
        limitEl.disabled = !isTable
        limitEl.style.opacity = isTable ? "1" : "0.55"
        if (!state.latestTax) return
        if (!isTable && !state.servicesGrouped) {
            const payload = await post("/services/impact", {
                ...state.latestTax,
                page: state.page,
                page_size: state.pageSize,
            })
            renderServiceCards(payload)
            return
        }
        if (state.latestServicesPayload)
            renderServiceCards(state.latestServicesPayload)
    })
document
    .getElementById("services-grouped")
    .addEventListener("change", async (e) => {
        state.servicesGrouped = e.target.checked
        state.page = 1
        if (!state.latestTax) return
        if (!state.servicesGrouped && state.servicesView !== "table") {
            const payload = await post("/services/impact", {
                ...state.latestTax,
                page: state.page,
                page_size: state.pageSize,
            })
            renderServiceCards(payload)
            return
        }
        if (state.latestServicesPayload)
            renderServiceCards(state.latestServicesPayload)
    })
document.getElementById("table-limit").addEventListener("change", (e) => {
    state.tableLimit = e.target.value
    state.page = 1
    if (state.latestServicesPayload)
        renderServiceCards(state.latestServicesPayload)
})
document.getElementById("map-mode").addEventListener("change", (e) => {
    state.mapMode = e.target.value
    if (state.latestFlows?.balances) {
        renderRegionalMap(state.latestFlows.balances, state.mapMode)
    }
})

document.querySelectorAll("#tax-form input, #tax-form select").forEach((el) => {
    el.addEventListener("change", syncShareUI)
    el.addEventListener("input", syncShareUI)
})
document.getElementById("service-cards").addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort]")
    if (!th) return
    const key = th.dataset.sort
    if (state.tableSortKey === key) {
        state.tableSortDir = state.tableSortDir === "asc" ? "desc" : "asc"
    } else {
        state.tableSortKey = key
        state.tableSortDir = key === "name" || key === "code" ? "asc" : "desc"
    }
    if (state.latestServicesPayload)
        renderServiceCards(state.latestServicesPayload)
})

document
    .getElementById("copy-share-link")
    .addEventListener("click", async () => {
        const url = buildShareUrl()
        await navigator.clipboard.writeText(url)
        setStatus("Shareable link copied to clipboard.")
    })

const SCENARIO_KEY = "taxes_saved_scenarios_v1"

function loadScenarios() {
    try {
        return JSON.parse(localStorage.getItem(SCENARIO_KEY) || "[]")
    } catch {
        return []
    }
}

function saveScenarios(items) {
    localStorage.setItem(SCENARIO_KEY, JSON.stringify(items))
}

function renderScenarioTable() {
    const rows = loadScenarios()
    const tbody = document.querySelector("#scenario-table tbody")
    if (!tbody) return
    tbody.innerHTML = rows
        .map(
            (r) => `
      <tr>
        <td>${r.name}</td>
        <td>${money(r.income)}</td>
        <td>${r.region}</td>
        <td>${money(r.total_tax)}</td>
        <td>${money(r.take_home)}</td>
        <td>${(r.effective_rate * 100).toFixed(1)}%</td>
      </tr>`,
        )
        .join("")
}

document.getElementById("save-scenario").addEventListener("click", () => {
    if (!state.latestTax || !state.latestTaxResponse) {
        setStatus("Run the model first to save a scenario.")
        return
    }
    const scenarios = loadScenarios()
    scenarios.push({
        name: `Scenario ${scenarios.length + 1}`,
        income: Number(state.latestTax.annual_income_gbp || 0),
        region: state.latestTax.region,
        total_tax: state.latestTaxResponse.total_estimated_tax_gbp,
        take_home: state.latestTaxResponse.take_home_gbp || 0,
        effective_rate: state.latestTaxResponse.effective_tax_rate,
    })
    saveScenarios(scenarios)
    renderScenarioTable()
})

document.getElementById("clear-scenarios").addEventListener("click", () => {
    saveScenarios([])
    renderScenarioTable()
})

window.addEventListener("resize", () => {
    if (state.latestFlows?.flows && state.latestFlows?.balances) {
        renderSankey(state.latestFlows.flows, state.latestFlows.balances)
    }
})

document.getElementById("theme-toggle").addEventListener("click", () => {
    const current =
        document.documentElement.getAttribute("data-theme") === "dark"
            ? "dark"
            : "light"
    const next = current === "dark" ? "light" : "dark"
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
    if (state.latestFlows?.flows && state.latestFlows?.balances) {
        renderSankey(state.latestFlows.flows, state.latestFlows.balances)
    }
})

const includeVatEl = document.getElementById("include-vat")
const vatRatioEl = document.getElementById("vat-ratio")
includeVatEl.addEventListener("change", () => {
    const enabled = includeVatEl.checked
    vatRatioEl.disabled = !enabled
    vatRatioEl.style.opacity = enabled ? "1" : "0.55"
})
initTheme()
applyQueryParamsToForm()
includeVatEl.dispatchEvent(new Event("change"))
document.getElementById("services-view").dispatchEvent(new Event("change"))
syncShareUI()
renderScenarioTable()

// Auto-load using default form values so the dashboard is immediately populated.
function triggerInitialLoad() {
    if (state.initialLoadDone) return
    state.initialLoadDone = true
    runModel().catch((err) => {
        setStatus(`Error: ${err.message}`)
    })
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", triggerInitialLoad, {
        once: true,
    })
} else {
    triggerInitialLoad()
}
