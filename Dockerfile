FROM node:18

# Instala ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Cria diretório da aplicação
WORKDIR /app

# Copia os arquivos
COPY . .

# Instala as dependências
RUN npm install

# Inicia o bot
CMD ["npm", "start"]
