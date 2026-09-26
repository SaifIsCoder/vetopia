import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Prescription } from '../../types/prescription';
import { ApiError } from '../api/errors';

/**
 * Generate formatted HTML markup for the digital veterinary prescription (FR-PRES-002).
 */
export function generatePrescriptionHtml(prescription: Prescription): string {
  const formattedDate = prescription.created_at
    ? new Date(prescription.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown Date';

  const vetName = prescription.vet?.name || 'Dr. Licensed Veterinarian';
  const vetSpecialty = prescription.vet?.specialty || 'General Veterinary Medicine';
  const vetCountry = prescription.vet?.country || 'International';

  const petName = prescription.pet?.name || 'Patient Pet';
  const petSpecies = prescription.pet?.species || 'Canine/Feline';
  const petBreed = prescription.pet?.breed ? ` • ${prescription.pet.breed}` : '';
  const petWeight = prescription.pet?.weight_kg ? ` • ${prescription.pet.weight_kg} kg` : '';
  const petAge = prescription.pet?.age ? ` • ${prescription.pet.age}` : '';

  const itemsHtml = (prescription.items || [])
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 12px; font-weight: 600; color: #111827; text-align: center;">${idx + 1}</td>
        <td style="padding: 12px; font-weight: 700; color: #111827;">${item.medication_name}</td>
        <td style="padding: 12px; color: #374151;">${item.dosage}</td>
        <td style="padding: 12px; color: #374151;">${item.frequency}</td>
        <td style="padding: 12px; color: #374151;">${item.duration}</td>
        <td style="padding: 12px; color: #4B5563; font-style: italic;">${item.special_instructions || 'None'}</td>
      </tr>
    `,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Vetopia Digital Prescription - ${prescription.id}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 32px;
          color: #131616;
          background-color: #FFFFFF;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #88C71B;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .brand-title {
          font-size: 24px;
          font-weight: 800;
          color: #131616;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .brand-sub {
          font-size: 11px;
          font-weight: 700;
          color: #88C71B;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .rx-meta {
          text-align: right;
          font-size: 12px;
          color: #4B5563;
        }
        .rx-badge {
          display: inline-block;
          background-color: #88C71B;
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 9999px;
          margin-top: 4px;
        }
        .grid-two {
          display: flex;
          gap: 20px;
          margin-bottom: 24px;
        }
        .card {
          flex: 1;
          background-color: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          padding: 16px;
        }
        .card-heading {
          font-size: 12px;
          font-weight: 700;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          border-bottom: 1px solid #E5E7EB;
          padding-bottom: 4px;
        }
        .entity-name {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
        }
        .entity-sub {
          font-size: 13px;
          color: #4B5563;
          line-height: 1.4;
        }
        .clinical-section {
          background-color: #F4F7EE;
          border-left: 4px solid #88C71B;
          padding: 14px;
          border-radius: 0 8px 8px 0;
          margin-bottom: 24px;
        }
        .diag-title {
          font-size: 12px;
          font-weight: 700;
          color: #4D7C0F;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .diag-text {
          font-size: 15px;
          font-weight: 600;
          color: #1F2937;
          margin-bottom: 6px;
        }
        .notes-text {
          font-size: 13px;
          color: #4B5563;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 13px;
        }
        th {
          background-color: #131616;
          color: #FFFFFF;
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
        }
        .footer {
          margin-top: 32px;
          border-top: 1px solid #E5E7EB;
          padding-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .signature-box {
          border-top: 2px solid #131616;
          width: 240px;
          padding-top: 8px;
          text-align: center;
        }
        .signature-title {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }
        .signature-sub {
          font-size: 11px;
          color: #6B7280;
        }
        .disclaimer {
          font-size: 10px;
          color: #9CA3AF;
          max-width: 380px;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand-sub">The Pets Club</div>
          <h1 class="brand-title">Vetopia Telemedicine</h1>
          <div style="font-size: 13px; color: #4B5563; margin-top: 2px;">Official Veterinary Digital Prescription</div>
        </div>
        <div class="rx-meta">
          <div><strong>Date:</strong> ${formattedDate}</div>
          <div><strong>Rx ID:</strong> ${prescription.id}</div>
          <div class="rx-badge">Refills: ${prescription.refills_allowed}</div>
        </div>
      </div>

      <div class="grid-two">
        <div class="card">
          <div class="card-heading">Prescribing Veterinarian</div>
          <div class="entity-name">${vetName}</div>
          <div class="entity-sub">
            <div>${vetSpecialty}</div>
            <div>Licensed Veterinary Practitioner (${vetCountry})</div>
            <div style="color: #16A34A; font-weight: 600; margin-top: 4px;">✓ Verified Vetopia Partner</div>
          </div>
        </div>

        <div class="card">
          <div class="card-heading">Patient Information</div>
          <div class="entity-name">${petName}</div>
          <div class="entity-sub">
            <div>${petSpecies}${petBreed}</div>
            <div>${petAge}${petWeight}</div>
            <div style="margin-top: 4px;">Appointment: #${prescription.appointment_id.slice(0, 8)}</div>
          </div>
        </div>
      </div>

      <div class="clinical-section">
        <div class="diag-title">Clinical Diagnosis</div>
        <div class="diag-text">${prescription.diagnosis}</div>
        ${prescription.notes ? `<div class="notes-text"><strong>Clinical Notes:</strong> ${prescription.notes}</div>` : ''}
      </div>

      <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 8px;">Prescribed Medications & Regimen</div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th>Medication</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
            <th>Special Instructions</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="footer">
        <div class="disclaimer">
          <strong>LEGAL DISCLAIMER:</strong> This is an authentic digital veterinary prescription issued following a verified telemedicine consultation on the Vetopia Mobile platform. Valid solely for the animal patient identified herein. Dispensation must comply with all regional veterinary pharmacy statutes. Controlled substances (Schedule II-V) are strictly prohibited and not covered by this digital instrument.
        </div>

        <div class="signature-box">
          <div class="signature-title">${vetName}</div>
          <div class="signature-sub">Electronically Signed & Sealed</div>
          <div style="font-size: 9px; color: #9CA3AF; margin-top: 2px;">Vetopia Medical Records Gateway</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Export digital prescription as PDF and prompt device share/save dialog (FR-PRES-002).
 */
export async function exportPrescriptionPdf(prescription: Prescription): Promise<string> {
  try {
    const html = generatePrescriptionHtml(prescription);
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Vetopia Prescription - ${prescription.pet?.name || 'Pet'}`,
        UTI: 'com.adobe.pdf',
      });
    }

    return uri;
  } catch (err: any) {
    throw new ApiError(err?.message || 'Failed to export prescription PDF.', 500);
  }
}
