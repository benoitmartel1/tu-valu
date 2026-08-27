@echo off
REM Apply CORS configuration to OVH S3 bucket using AWS CLI
REM Usage: apply-cors.bat

echo 🔧 Applying CORS configuration to OVH S3 bucket...

REM Load environment variables from .env file
for /f "tokens=1,2 delims==" %%a in (api\.env) do (
    set %%a=%%b
)

REM Set defaults if not defined
if not defined OVH_S3_ENDPOINT set OVH_S3_ENDPOINT=https://s3.bhs.io.cloud.ovh.net
if not defined OVH_S3_BUCKET set OVH_S3_BUCKET=young-blackett
if not defined OVH_S3_REGION set OVH_S3_REGION=bhs

echo    Bucket: %OVH_S3_BUCKET%
echo    Endpoint: %OVH_S3_ENDPOINT%
echo    Region: %OVH_S3_REGION%

REM Apply CORS configuration using AWS CLI
aws s3api put-bucket-cors ^
    --endpoint-url %OVH_S3_ENDPOINT% ^
    --bucket %OVH_S3_BUCKET% ^
    --cors-configuration file://cors.json ^
    --region %OVH_S3_REGION%

if %errorlevel% equ 0 (
    echo.
    echo ✅ CORS configuration successfully applied!
    echo.
    echo Allowed Origins:
    echo    - http://localhost:5173
    echo    - https://dev.benoitmartel.com
    echo.
    echo Allowed Methods: POST, PUT, GET, HEAD
    echo Max Age: 3000 seconds
) else (
    echo.
    echo ❌ Failed to apply CORS configuration
    echo.
    echo Troubleshooting:
    echo 1. Verify your OVH S3 credentials are set in api\.env
    echo 2. Ensure you have permission to modify bucket CORS settings
    echo 3. Check that the bucket name is correct
)

pause
