set PATH=%PATH%;C:\Program Files\nodejs
call npm install
node seed.js
start /B node server.js
