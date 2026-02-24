#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="${ROOT_DIR}/data/raw"
mkdir -p "${RAW_DIR}"

fetch() {
  local url="$1"
  local out="$2"
  echo "Downloading ${out##*/}"
  if ! curl -fL --retry 2 --connect-timeout 20 "$url" -o "${RAW_DIR}/${out}"; then
    echo "WARN: failed to download ${url}" >&2
  fi
}

fetch "https://assets.publishing.service.gov.uk/media/6874fe33b1b4ebc2c2e46574/PESA_2025_CP_Chapter_4_tables.xlsx" "pesa_2025_ch4_tables.xlsx"
fetch "https://assets.publishing.service.gov.uk/media/6874fe4582370235232f9343/PESA_2025_CP_Chapter_5_tables.xlsx" "pesa_2025_ch5_tables.xlsx"
fetch "https://assets.publishing.service.gov.uk/media/68763b0ea8d0255f9fe28eb5/PSS_July_2025_Chapter_1.xlsx" "public_spending_departmental_budgets_july_2025.xlsx"
fetch "https://assets.publishing.service.gov.uk/media/68763b3ea8d0255f9fe28eb6/PSS_July_2025_Chapter_4.xlsx" "public_spending_trends_july_2025.xlsx"
fetch "https://www.ons.gov.uk/file?uri=%2Feconomy%2Fgovernmentpublicsectorandtaxes%2Fpublicsectorfinance%2Fdatasets%2Fcountryandregionalpublicsectorfinancesrevenuetables%2Ffinancialyearending2023%2Fcrpsffye2023totalpublicsectorcurrentreceipts.xlsx" "ons_regional_revenue_fye2023.xlsx"
fetch "https://www.ons.gov.uk/file?uri=%2Feconomy%2Fgovernmentpublicsectorandtaxes%2Fpublicsectorfinance%2Fdatasets%2Fcountryandregionalpublicsectorfinancesexpendituretables%2Ffinancialyearending2023%2Fcrpsffye2023expendituretables.xlsx" "ons_regional_expenditure_fye2023.xlsx"
fetch "https://hub.arcgis.com/api/v3/datasets/3959874c514b470e9dd160acdc00c97a_0/downloads/data?format=csv&spatialRefId=4326&where=1%3D1" "ons_lad_to_region_2024.csv"

echo
echo "Downloaded files:"
ls -lh "${RAW_DIR}"

echo
echo "SHA256 checksums:"
(
  cd "${RAW_DIR}"
  sha256sum \
    pesa_2025_ch4_tables.xlsx \
    pesa_2025_ch5_tables.xlsx \
    public_spending_departmental_budgets_july_2025.xlsx \
    public_spending_trends_july_2025.xlsx \
    ons_regional_revenue_fye2023.xlsx \
    ons_regional_expenditure_fye2023.xlsx \
    ons_lad_to_region_2024.csv
)
