# In newer versions of node the geonames-importer package causes a stack overflow.
FROM node:0
ADD . .
RUN npm install
CMD npm run start
