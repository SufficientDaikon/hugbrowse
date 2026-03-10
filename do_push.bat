@echo off
cd /d "h:\Hugging pc\hugbrowse"
echo Fetching token...
for /f "tokens=*" %%i in ('gh auth token') do set GH_TOKEN=%%i
echo Token acquired.
echo Setting remote with token...
git remote set-url origin https://x-access-token:%GH_TOKEN%@github.com/SufficientDaikon/hugbrowse.git
echo Pushing...
git push origin master
echo.
echo Restoring clean remote URL...
git remote set-url origin https://github.com/SufficientDaikon/hugbrowse.git
echo Done. Exit code: %ERRORLEVEL%
pause
