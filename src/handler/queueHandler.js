const { BlobServiceClient } = require("@azure/storage-blob");
const axios = require("axios");
const { randomUUID } = require("crypto");
const FormData = require("form-data");
const cosmosSingleton = require("../lib/cosmos/cosmos");
const { extractSOAPSections } = require("../lib/index");
const { streamToBuffer } = require("../lib/index");
const prisma = require("../lib/prisma");
const { env_config } = require("../config/env-config");
module.exports = async function (message, context) {
  const { audioUrl, patientId, physicianId } = message;
  try {
    // Download audio from Azure Blob Storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      env_config.azureBlobConnectionString
    );
    const blobUrl = new URL(audioUrl);
    const containerClient = blobServiceClient.getContainerClient(
      blobUrl.pathname.split("/")[1]
    );
    const blobName = decodeURIComponent(blobUrl.pathname.split("/").pop());
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    context.log("Downloading audio file from Blob Storage...");
    const downloaded = await streamToBuffer(
      downloadBlockBlobResponse.readableStreamBody
    );
    context.log("Downloaded audio file from Blob Storage.");

    // Transcribe the audio file
    const formData = new FormData();
    formData.append("file", downloaded, {
      filename: "audio.wav",
      contentType: "audio/wav",
    });

    const [transcriptionResponse, container] = await Promise.all([
      axios.post(
        `${env_config.azure_endpoint}/openai/deployments/eka-whisper/audio/transcriptions?api-version=2024-02-01`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            "api-key": env_config.openai_key,
          },
        }
      ),
      cosmosSingleton.getContainer("Conversation"),
    ]);

    const transcription = transcriptionResponse.data.text;
    context.log("Transcription: ", transcription);

    const { resource: createdConversation } = await container.items.create({
      id: `${patientId}_${physicianId}`,
      transcription,
      PatientId: patientId,
      PhysicianId: physicianId,
      type: "conversation",
    });

    // Generate SOAP note
    const completionResponse = await axios.post(
      `${env_config.azure_endpoint}/openai/deployments/eka-gpt4o/chat/completions?api-version=2024-04-01-preview`,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant designed to assist doctors by transcribing and summarizing medical conversations into structured SOAP notes. Please produce a SOAP note based on the conversation between a doctor and a patient, following this detailed format:\n\nSubjective:\n- [Include reasons for visit, chief complaints, symptoms, etc. only if explicitly mentioned in the transcript, contextual notes, or clinical note. Otherwise, leave blank.]\n- [Include details about the complaint, duration, timing, location, quality, severity, context, progression, associated symptoms, and impact on daily activities only if explicitly mentioned in the transcript, contextual notes, or clinical note. Otherwise, leave blank.]\n- [Include any self-treatment attempts and their effectiveness if explicitly mentioned. Otherwise, leave blank.]\n\nPast Medical History:\n- [Include contributing factors, past medical and surgical history, relevant social and family history, exposure history, immunization status, and any other relevant subjective information if explicitly mentioned. Otherwise, leave blank.]\n\nObjective:\n- Physical Exam:\n  - [Include detailed examination findings, including system-specific examinations if explicitly mentioned. Otherwise, leave blank.]\n- Vitals:\n  - [Include vital signs such as temperature, blood pressure, heart rate, respiratory rate, and oxygen saturation if explicitly mentioned. Otherwise, leave blank.]\n- Investigations with Results:\n  - [Include completed investigations and results only if explicitly mentioned. Planned or ordered investigations should be included under Plan.]\n\nAssessment:\n- [Include likely diagnoses and differential diagnoses if explicitly mentioned. Otherwise, leave blank.]\n\nPlan:\n- [Include details on treatment, medications, follow-up instructions, patient education, and planned investigations only if explicitly mentioned. Otherwise, leave blank.]\n\nMedical Codes:\n- ICD-10: [Include ICD-10 codes relevant to the diagnoses.]\n- CPT: [Include CPT codes relevant to the procedures performed.]\n\n(Do not include a SOAP note heading. Use only the provided transcript, contextual notes, or clinical note as a reference for the information. Ensure the note is clear, concise, and free of asterisks or unnecessary formatting elements.)",
          },
          {
            role: "user",
            content: transcription,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": env_config.openai_key,
        },
      }
    );

    const responseContent = completionResponse.data.choices[0].message.content;
    const sections = extractSOAPSections(responseContent);

    const medicalcodeTab = sections["Medical Codes"];

    context.log("Medical Codes: ", medicalcodeTab);

    const { resource: createdNote } = await container.items.create({
      id: `${randomUUID()}|${patientId}|${physicianId}`,
      Doctor_Patient_Discussion: responseContent,

      PatientId: patientId,
      PhysicianId: physicianId,
      tabs: [
        {
          id: randomUUID(),
          name: "Medical Codes",
          content: medicalcodeTab,
        },
      ],
      type: "note",
    });

    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: { generating: false },
    });

    context.log("Updated patient: ", updatedPatient);
    context.log("Generated SOAP note: ", createdNote);
  } catch (error) {
    context.log("Error processing message: ", error.message);
  }
};
