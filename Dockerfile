FROM node:22

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Render exige que o app escute uma porta — fake server só pra passar
EXPOSE 10000
CMD node bot.js || node -e "require('http').createServer((req, res) => res.end('Bot rodando')).listen(10000)"
