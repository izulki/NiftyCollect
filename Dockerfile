FROM node:16

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install -g typescript
RUN npm install -g ts-node
RUN npm install
# RUN npm ci --only=production

# Bundle app source
COPY . /usr/src/app

CMD ["npx", "ts-node", "topshot/setsMonitor.ts" ]


