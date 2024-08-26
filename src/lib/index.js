async function streamToBuffer(readableStream) {
  if (!readableStream) {
    throw new Error("Readable stream is null");
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on("error", reject);
  });
}

function extractSOAPSections(note) {
  const sections = {};

  const sectionNames = [
    "Subjective",
    "Past Medical History",
    "Objective",
    "Assessment",
    "Plan",
    "Medical Codes",
  ];

  let currentSection = null;
  let currentContent = [];

  // Split the note into lines
  const lines = note.split("\n");

  lines.forEach((line) => {
    // Trim the line to remove leading/trailing whitespace
    const trimmedLine = line.trim();

    // Check if the line starts with a known section name
    if (sectionNames.some((name) => trimmedLine.startsWith(name))) {
      // Save the current section's content before starting a new one
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join("\n").trim();
      }

      // Update the current section and reset content
      currentSection = trimmedLine.split(":")[0];
      currentContent = [trimmedLine.split(":").slice(1).join(":").trim()];
    } else if (currentSection) {
      // Add the line to the current section's content
      currentContent.push(trimmedLine);
    }
  });

  // Save the last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join("\n").trim();
  }

  return sections;
}

module.exports = { streamToBuffer, extractSOAPSections };
