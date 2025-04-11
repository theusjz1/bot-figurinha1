# Usa uma imagem Node.js oficial com ffmpeg instalado
FROM jrottenberg/ffmpeg:4.4-ubuntu

# Instala o Node.js LTS e outras dependências
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos do projeto
COPY . .

# Instala as dependências do projeto
RUN npm install

# Expõe a porta (pode não ser usada, mas evita erro)
EXPOSE 3000

# Comando para iniciar o bot
CMD ["node", "bot.js"]
