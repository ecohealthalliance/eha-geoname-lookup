FROM node:5
EXPOSE 80
RUN mkdir app
ADD . app
WORKDIR app
RUN npm install
RUN npm run docs
CMD npm run start
