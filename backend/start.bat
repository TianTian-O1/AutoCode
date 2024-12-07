@echo off
echo Starting Cursor API Server...

:: Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install express body-parser node-fetch uuid
)

:: Check if package.json exists
if not exist "package.json" (
    echo Creating package.json...
    echo {> package.json
    echo   "type": "module",>> package.json
    echo   "dependencies": {>> package.json
    echo     "express": "^4.18.2",>> package.json
    echo     "body-parser": "^1.20.2",>> package.json
    echo     "node-fetch": "^3.3.2",>> package.json
    echo     "uuid": "^9.0.1">> package.json
    echo   }>> package.json
    echo }>> package.json
)

:: Start the server
echo Starting server...
node server.js

pause