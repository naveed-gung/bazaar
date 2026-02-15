// Test setup — uses MongoDB Memory Server if available, otherwise mocks
let mongoServer;
let useMemoryServer = false;

try {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  useMemoryServer = true;

  module.exports.connect = async () => {
    const mongoose = require('mongoose');
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  };

  module.exports.closeDatabase = async () => {
    const mongoose = require('mongoose');
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) await mongoServer.stop();
  };

  module.exports.clearDatabase = async () => {
    const mongoose = require('mongoose');
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  };
} catch {
  // mongodb-memory-server not installed — provide stub helpers
  module.exports.connect = async () => {};
  module.exports.closeDatabase = async () => {};
  module.exports.clearDatabase = async () => {};
  module.exports.needsMongoMemoryServer = true;
}
