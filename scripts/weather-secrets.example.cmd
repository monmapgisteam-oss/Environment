@echo off
rem  Copy this file to  scripts\weather-secrets.cmd  and fill in the values.
rem  weather-secrets.cmd is gitignored, so nothing secret reaches git.
rem  ASCII only -- cmd.exe cannot parse Cyrillic comments reliably.

set "WEATHER_LAYER_URL=https://environment.ub.gov.mn/hosting/rest/services/Hosted/Tsag_agaar_arhiv/FeatureServer/0"

rem  Registered application (OAuth 2.0)
set "ARCGIS_CLIENT_ID="
set "ARCGIS_CLIENT_SECRET="

rem  Or a portal account -- leave the two above empty and fill these instead
rem  set "ARCGIS_USER="
rem  set "ARCGIS_PASSWORD="

rem  capital = 7 stations in Ulaanbaatar,  all = 317 stations nationwide
set "WEATHER_SCOPE=capital"
