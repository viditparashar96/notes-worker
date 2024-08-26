const { app } = require("@azure/functions");
const queueHandler = require("../handler/queueHandler");
app.serviceBusQueue("serviceBusQueueTrigger2", {
  connection: "hsiscribe_SERVICEBUS",
  queueName: "notesqueue",
  handler: queueHandler,
});
