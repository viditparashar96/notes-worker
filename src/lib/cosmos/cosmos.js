const { CosmosClient } = require("@azure/cosmos");
const dotenv = require("dotenv");
dotenv.config();
class CosmosSingleton {
  constructor() {
    this.database = null;
    this.containers = {};
    this.client = new CosmosClient(process.env.COSMOSDB_CONNECTION_STRING);
  }

  async initialize() {
    if (!this.database) {
      try {
        const databaseName = "HSI";
        const database = this.client.database(databaseName);
        await this.client.databases.createIfNotExists({ id: databaseName });
        this.database = database;
      } catch (error) {
        throw new Error("Error while creating/accessing Cosmos database");
      }
    }
  }

  async getContainer(containerName) {
    if (!this.database) {
      await this.initialize();
    }

    if (!this.containers[containerName]) {
      try {
        await this.database.containers.createIfNotExists({
          id: containerName,
          partitionKey: "/id",
        });
        this.containers[containerName] = this.database.container(containerName);
      } catch (error) {
        console.log("Error while creating/accessing Cosmos container:", error);
        throw new Error("Error while creating/accessing Cosmos container");
      }
    }

    return this.containers[containerName];
  }

  getDatabase() {
    return this.database;
  }
}

const cosmosSingleton = new CosmosSingleton();
module.exports = cosmosSingleton;
