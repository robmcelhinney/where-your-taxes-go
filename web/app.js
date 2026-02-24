const state = {
    apiBase: "http://127.0.0.1:8000",
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
    "#d97706",
    "#b45309",
    "#3f6212",
    "#0c4a6e",
    "#be123c",
    "#334155",
    "#7c2d12",
    "#166534",
    "#7c3aed",
    "#0e7490",
    "#92400e",
]

const REGION_POPULATION_ITL1 = {
    "North East": 2684000,
    "North West": 7614000,
    "Yorkshire and The Humber": 5567000,
    "East Midlands": 4941000,
    "West Midlands": 6029000,
    "East of England": 6410000,
    London: 8962000,
    "South East": 9417000,
    "South West": 5817000,
    Wales: 3133000,
    Scotland: 5490000,
    "Northern Ireland": 1916000,
}

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
        toggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`)
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
    const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches
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
    const r = await fetch(`${state.apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!r.ok) {
        throw new Error(`${path} failed (${r.status})`)
    }
    return r.json()
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
        ["Student loan", -(tax.student_loan_repayment_gbp || 0), "#7c2d12"],
        [
            "Savings/dividend tax",
            -((tax.savings_tax_gbp || 0) + (tax.dividend_tax_gbp || 0)),
            "#7c3aed",
        ],
        ["VAT estimate", -tax.vat_estimate_gbp, "#0369a1"],
        ["Council tax", -tax.council_tax_estimate_gbp, "#334155"],
        [
            "Estimated take-home",
            tax.take_home_gbp || gross - tax.total_estimated_tax_gbp,
            "#166534",
        ],
    ]
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
    const top = services.slice(0, 15)
    const totalServicePct = services.reduce(
        (a, s) => a + s.share_of_user_tax_percent,
        0,
    )
    const topServicePct = top.reduce(
        (a, s) => a + s.share_of_user_tax_percent,
        0,
    )
    const otherServicesPct = Math.max(0, totalServicePct - topServicePct)
    const unattributedPct = Math.max(0, 100 - totalServicePct)

    const all = top.map((s) => ({ ...s }))
    const everythingElsePct = Math.max(0, otherServicesPct + unattributedPct)
    if (everythingElsePct > 0.01) {
        all.push({
            function_label: "Everything else",
            user_contribution_gbp: (userTotalTax * everythingElsePct) / 100,
            share_of_user_tax_percent: everythingElsePct,
            _other_services_pct: otherServicesPct,
            _unattributed_pct: unattributedPct,
        })
    }

    const pie = document.getElementById("pie")
    pie.innerHTML = `<svg viewBox="0 0 160 160" class="pie-svg"></svg><div id="pie-tip" class="pie-tip"></div>`
    const svg = pie.querySelector("svg")
    const tip = document.getElementById("pie-tip")

    let startAngle = -Math.PI / 2
    const cx = 80
    const cy = 80
    const r = 78
    all.forEach((s, i) => {
        const share = s.share_of_user_tax_percent / 100
        const sweep = Math.max(share * Math.PI * 2, 0.0001)
        const endAngle = startAngle + sweep
        const x1 = cx + r * Math.cos(startAngle)
        const y1 = cy + r * Math.sin(startAngle)
        const x2 = cx + r * Math.cos(endAngle)
        const y2 = cy + r * Math.sin(endAngle)
        const largeArc = sweep > Math.PI ? 1 : 0
        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
        )
        path.setAttribute(
            "d",
            `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
        )
        path.setAttribute("fill", palette[i % palette.length])
        path.setAttribute("stroke", "#ffffff")
        path.setAttribute("stroke-width", "1")
        path.style.cursor = "pointer"

        const { code, name } = cleanFunctionLabel(s.function_label)
        const label = code ? `${name} (COFOG ${code})` : name
        const pct = s.share_of_user_tax_percent.toFixed(1)
        const isEverythingElse = s.function_label === "Everything else"
        const breakdown = isEverythingElse
            ? ` • remaining services ${(s._other_services_pct || 0).toFixed(1)}%, unallocated ${(s._unattributed_pct || 0).toFixed(1)}%`
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
        startAngle = endAngle
    })

    const legend = document.getElementById("pie-legend")
    legend.innerHTML = all
        .map((s, i) => {
            const { code, name } = cleanFunctionLabel(s.function_label)
            const extra = code ? ` (COFOG ${code})` : ""
            const pct = s.share_of_user_tax_percent.toFixed(1)
            const isEverythingElse = s.function_label === "Everything else"
            const breakdown = isEverythingElse
                ? ` (remaining services ${(s._other_services_pct || 0).toFixed(1)}% + unallocated ${(s._unattributed_pct || 0).toFixed(1)}%)`
                : ""
            return `
        <li>
          <span class="swatch" style="background:${palette[i % palette.length]}"></span>
          <span>${name}${extra}: ${pct}% of your total tax${breakdown}</span>
        </li>`
        })
        .join("")
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
                <div><strong>${s.spending_amount_m_gbp.toFixed(0)}m GBP</strong> national spend</div>
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
    const values = balances.map((b) => {
        if (!isPerCapita) return b.net_balance_m_gbp
        const pop = REGION_POPULATION_ITL1[b.geography_name]
        if (!pop) return 0
        return (b.net_balance_m_gbp * 1_000_000) / pop
    })
    const max = Math.max(...values.map((v) => Math.abs(v)), 1)
    const root = document.getElementById("uk-map")
    root.innerHTML = balances
        .map((b, idx) => {
            const displayValue = values[idx]
            const ratio = Math.abs(displayValue) / max
            const color =
                displayValue >= 0
                    ? `rgba(22, 101, 52, ${0.35 + ratio * 0.55})`
                    : `rgba(153, 27, 27, ${0.35 + ratio * 0.55})`
            const valueText = isPerCapita
                ? `${displayValue >= 0 ? "+" : ""}${money(displayValue)} / resident`
                : `${b.net_balance_m_gbp >= 0 ? "+" : ""}£${(b.net_balance_m_gbp / 1000).toFixed(1)}bn`
            const title = isPerCapita
                ? "Net balance per resident (GBP)"
                : "Total net balance (million GBP)"
            return `
        <div class="tile" style="background:${color}" aria-label="${b.geography_name}: ${valueText}">
          <div class="name">${b.geography_name}</div>
          <div class="net" title="${title}">${valueText}</div>
        </div>
      `
        })
        .join("")
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

    const h = 420
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
    const leftLabelX = 16
    const leftFlowX = 88
    const rightFlowX = 740
    const rightLabelX = 890
    const c1 = 270
    const c2 = 555
    svg.innerHTML = ""
    const ns = "http://www.w3.org/2000/svg"
    const bg = document.createElementNS(ns, "rect")
    bg.setAttribute("x", "0")
    bg.setAttribute("y", "0")
    bg.setAttribute("width", "900")
    bg.setAttribute("height", "420")
    bg.setAttribute("fill", sankeyBg)
    svg.appendChild(bg)

    const nodeTextEls = new Map()
    donors.forEach((d) => {
        const y = donorY.get(d.geography_name) || 0
        const text = document.createElementNS(ns, "text")
        text.setAttribute("x", `${leftLabelX}`)
        text.setAttribute("y", `${y + 4}`)
        text.setAttribute("font-size", "12")
        text.setAttribute("font-weight", "700")
        text.setAttribute("fill", sankeyText)
        text.textContent = d.geography_name
        svg.appendChild(text)
        nodeTextEls.set(d.geography_name, text)
    })
    recips.forEach((r) => {
        const y = recipY.get(r.geography_name) || 0
        const text = document.createElementNS(ns, "text")
        text.setAttribute("x", `${rightLabelX}`)
        text.setAttribute("y", `${y + 4}`)
        text.setAttribute("font-size", "12")
        text.setAttribute("font-weight", "700")
        text.setAttribute("text-anchor", "end")
        text.setAttribute("fill", sankeyText)
        text.textContent = r.geography_name
        svg.appendChild(text)
        nodeTextEls.set(r.geography_name, text)
    })

    const linkEls = []
    allFlows.forEach((f, i) => {
        const y1 = donorY.get(f.origin_region)
        const y2 = recipY.get(f.destination_region)
        if (!y1 || !y2) return
        const width = Math.max(1.25, 0.6 + (f.value_m_gbp / maxFlow) * 14)
        const c = palette[i % palette.length]
        const path = document.createElementNS(ns, "path")
        path.setAttribute(
            "d",
            `M${leftFlowX},${y1} C${c1},${y1} ${c2},${y2} ${rightFlowX},${y2}`,
        )
        path.setAttribute("fill", "none")
        path.setAttribute("stroke", c)
        path.setAttribute("stroke-width", `${width}`)
        path.setAttribute("stroke-opacity", "0.52")
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
            el.setAttribute("stroke-opacity", "0.52")
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
    state.apiBase = document.getElementById("api-base").value.trim()
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

function buildShareUrl() {
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

function updateAddressBar() {
    const url = buildShareUrl()
    history.replaceState(null, "", url)
}

function syncShareUI() {
    const url = buildShareUrl()
    updateAddressBar()
    const text = "I mapped my UK tax footprint with Where Your Taxes Go."
    const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
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

document
    .getElementById("export-journalist")
    .addEventListener("click", async () => {
        if (!state.latestTax) {
            setStatus("Run the model first before exporting.")
            return
        }
        setStatus("Building journalist export...")
        try {
            const payload = { ...state.latestTax }
            const exportData = await post("/journalist/export", payload)
            const stamp = new Date().toISOString().slice(0, 10)
            downloadTextFile(
                `taxes-export-${stamp}.json`,
                JSON.stringify(exportData, null, 2),
                "application/json",
            )
            downloadTextFile(
                `services-impact-${stamp}.csv`,
                exportData.services_csv,
                "text/csv",
            )
            downloadTextFile(
                `regional-balances-${stamp}.csv`,
                exportData.regional_balances_csv,
                "text/csv",
            )
            setStatus("Journalist export downloaded (JSON + CSV files).")
        } catch (err) {
            setStatus(`Error: ${err.message}`)
        }
    })

document.getElementById("export-pdf").addEventListener("click", () => {
    window.print()
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
