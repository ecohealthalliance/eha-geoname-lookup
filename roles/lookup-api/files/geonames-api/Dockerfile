FROM node:5
EXPOSE 80
RUN mkdir app
ADD . app
WORKDIR app
RUN npm install
CMD npm run docs && npm run start
