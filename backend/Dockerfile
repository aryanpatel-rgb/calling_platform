# FROM node:18-alpine

# # Set working directory
# WORKDIR /usr/src/app

# # Copy package.json and install dependencies
# COPY package*.json ./
# RUN npm install --production

# # Copy rest of the application files
# COPY . .

# # Expose the port your app runs on
# EXPOSE 3000

# # Define the command to run your app
# CMD ["npm", "start"]

FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install 

COPY . .

EXPOSE 3000

CMD ["npm", "start"]