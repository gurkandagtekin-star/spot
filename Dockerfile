FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.dependencies={express:p.dependencies.express,cors:p.dependencies.cors,'socket.io':p.dependencies['socket.io'],pg:p.dependencies.pg}; p.devDependencies={}; delete p.scripts; fs.writeFileSync('package.json', JSON.stringify(p,null,2));" \
  && npm install --omit=dev
COPY server ./server
RUN mkdir -p server/uploads
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "server/index.js"]
