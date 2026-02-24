# Data Sources Inventory

Status: Phase 1 discovery in progress (updated February 24, 2026).

Current raw downloads completed:
- `data/raw/pesa_2025_ch4_tables.xlsx`
- `data/raw/pesa_2025_ch5_tables.xlsx`
- `data/raw/public_spending_departmental_budgets_july_2025.xlsx`
- `data/raw/public_spending_trends_july_2025.xlsx`
- `data/raw/ons_regional_revenue_fye2023.xlsx`
- `data/raw/ons_regional_expenditure_fye2023.xlsx`
- `data/raw/ons_lad_to_region_2024.csv`

Current extracted snapshots completed:
- `data/processed/functional_spending_2024_25.csv` (from PESA table 5.2)
- `data/processed/departmental_spending_2024_25.csv` (from PSS table 1.12)
- `data/processed/ons_regional_revenue_fye2023.csv` (ONS receipts, normalized with geography codes)
- `data/processed/ons_regional_expenditure_fye2023.csv` (ONS expenditure, normalized with geography codes)
- `data/processed/council_to_region_2024.csv` (LAD-to-region mapping)
- `data/processed/official_uk_borrowing.csv` (ONS PSNB ex, official borrowing benchmark)

## HM Treasury (National Spending)

Primary source pages:
- Public Expenditure Statistical Analyses 2025:
  - https://www.gov.uk/government/statistics/public-expenditure-statistical-analyses-2025
- Public Spending Statistics release July 2025:
  - https://www.gov.uk/government/statistics/public-spending-statistics-release-july-2025

Confirmed downloadable files:
- PESA 2025 chapter 4 tables:
  - https://assets.publishing.service.gov.uk/media/6874fe33b1b4ebc2c2e46574/PESA_2025_CP_Chapter_4_tables.xlsx
- PESA 2025 chapter 5 tables:
  - https://assets.publishing.service.gov.uk/media/6874fe4582370235232f9343/PESA_2025_CP_Chapter_5_tables.xlsx
- Public Spending Statistics departmental budgets tables:
  - https://assets.publishing.service.gov.uk/media/68763b0ea8d0255f9fe28eb5/PSS_July_2025_Chapter_1.xlsx
- Public Spending Statistics trends in public spending tables:
  - https://assets.publishing.service.gov.uk/media/68763b3ea8d0255f9fe28eb6/PSS_July_2025_Chapter_4.xlsx

Planned extraction fields:
- Functional category (`function`)
- Department (`department`)
- Amount (`amount`)
- Year (`year`)

## ONS Regional Public Finance

Primary source pages:
- Country and regional public sector finances: financial year ending 2024:
  - https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/articles/countryandregionalpublicsectorfinances/financialyearending2024
- Dataset: Public sector revenue by country and region:
  - https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/datasets/publicsectorrevenuebycountryandregion
- Dataset: Public sector expenditure by country and region:
  - https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/datasets/publicsectorexpenditurebycountryandregion

Confirmed downloadable files:
- Revenue by country and region:
  - https://www.ons.gov.uk/file?uri=%2Feconomy%2Fgovernmentpublicsectorandtaxes%2Fpublicsectorfinance%2Fdatasets%2Fcountryandregionalpublicsectorfinancesrevenuetables%2Ffinancialyearending2023%2Fcrpsffye2023totalpublicsectorcurrentreceipts.xlsx
- Expenditure by country and region:
  - https://www.ons.gov.uk/file?uri=%2Feconomy%2Fgovernmentpublicsectorandtaxes%2Fpublicsectorfinance%2Fdatasets%2Fcountryandregionalpublicsectorfinancesexpendituretables%2Ffinancialyearending2023%2Fcrpsffye2023expendituretables.xlsx

Additional ONS borrowing source (official benchmark):
- Public sector finances bulletin:
  - https://www.ons.gov.uk/economy/governmentpublicsectorandtaxes/publicsectorfinance/bulletins/publicsectorfinances/january2026
- Metric extracted:
  - Public sector net borrowing excluding public sector banks (PSNB ex), reference period FYE March 2025: `£152.7bn`
  - CSV now stores both bulletin release period (for example `January 2026`) and reference period (for example `FYE March 2025`) to avoid ambiguity.

## Local Authority Finance

Identified datasets/pages:
- England local authority revenue expenditure and financing:
  - https://www.gov.uk/government/statistics/local-authority-revenue-expenditure-and-financing-england-2023-to-2024-final-outturn
- Scotland local government finance statistics:
  - https://www.gov.scot/collections/local-government-finance-statistics/
- Wales local government finance statistics:
  - https://statswales.gov.wales/Catalogue/Local-Government/Finance
- Northern Ireland local government financial statistics:
  - https://www.nisra.gov.uk/publications/local-government-financial-statistics

Council to region mapping source:
- ONS Local Authority District to Region lookup:
  - https://geoportal.statistics.gov.uk/datasets/ons::local-authority-district-to-region-april-2024-lookup-in-united-kingdom/about
- CSV download:
  - https://hub.arcgis.com/api/v3/datasets/3959874c514b470e9dd160acdc00c97a_0/downloads/data?format=csv&spatialRefId=4326&where=1%3D1

## Aggregation Level Decision (Phase 1)

- National and regional model baseline: ITL1 / UK nation level annual data.
- Local authority integration: LAD-level inputs rolled up to ITL1 for consistency with ONS regional finance datasets.
- Currency basis: nominal GBP in source year; inflation adjustment deferred to a later phase.

## Known Yearly Schema Differences

- ONS geography structures can change across releases (for example, code updates and notes/corrections between editions).
- Local authority boundaries and naming can shift between financial years.
- Treasury table structures can move between workbook tabs or chapter tables year-to-year.

## Unified Intake Fields (Proposed)

- `source_name`
- `source_url`
- `dataset_id`
- `dataset_version`
- `year`
- `geography_code`
- `geography_name`
- `level`
- `function`
- `department`
- `amount`
- `currency`
- `notes`

## Remaining Discovery Tasks

- Validate license/attribution requirements per source.
- Document any deltas when ONS publishes next edition/version.
