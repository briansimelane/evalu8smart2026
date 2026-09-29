import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TeamMarksResult, WorldMarksResult, MARKS_CRITERIA } from '@/lib/marks/syndicateMarks';

function sanitizeFilename(str: string): string {
  return (str || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatCurrency(val: number): string {
  return '$' + Math.round(val).toLocaleString();
}

function formatPercent(val: number, decimals = 1): string {
  return (val * 100).toFixed(decimals) + '%';
}

function formatPoints(val: number): string {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)} pp`;
}

function formatZPosition(z: number): string {
  if (Math.abs(z) < 1e-6) return 'At average';
  if (z > 0) return `+${z.toFixed(2)} SD above average`;
  return `-${Math.abs(z).toFixed(2)} SD below average`;
}

function formatMarksContrib(val: number): string {
  if (Math.abs(val) < 1e-6) return '0.0';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}`;
}

/** Generates and downloads the per-team PDF (D10: own results only, v1.1 StdDev format). */
export async function generateTeamMarksPdf(
  team: TeamMarksResult,
  world: WorldMarksResult,
  className: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('Syndicate Assignment - Business Simulation Results', margin, 16);

  // Subheaders
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Class / World: ${className}`, margin, 22);
  doc.text(`Team ${team.teamNumber}: ${team.teamName}`, margin, 27);

  const statusText = world.isFinal ? `Final - Round ${world.asAtRound}` : `Marks as at end of Round ${world.asAtRound}`;
  doc.text(statusText, margin, 32);

  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, 16, { align: 'right' });

  // Table 1 — Mark Summary (v1.1 StdDev format)
  const table1Head = [['Criterion', 'Weight', 'Your Result', 'World Average', 'Your Position', 'Marks']];
  const table1Body: any[] = [];

  // Criteria rows 1-5
  MARKS_CRITERIA.forEach((crit) => {
    const meanVal = world.means[crit.key] ?? 0;
    const displayResult = crit.format === 'currency' ? formatCurrency(team.totals[crit.key]) : team.totals[crit.key].toString();
    const displayMean = crit.format === 'currency' ? formatCurrency(meanVal) : meanVal.toFixed(1);
    const weightPct = `${Math.round(world.positiveWeightSum > 0 ? (team.contributions[crit.key] !== 0 ? (team.contributions[crit.key] / (team.averageMark * team.zScores[crit.key])) * 100 : 20) : 20)}%`;

    table1Body.push([
      crit.label,
      '20.0%',
      displayResult,
      displayMean,
      formatZPosition(team.zScores[crit.key]),
      formatMarksContrib(team.contributions[crit.key]),
    ]);
  });

  // Average mark starting point row
  table1Body.push([
    { content: 'Average mark starting point', styles: { fontStyle: 'bold' } },
    '',
    '',
    '',
    '',
    { content: team.averageMark.toFixed(1), styles: { fontStyle: 'bold' } },
  ]);

  // Less: lost products row
  table1Body.push([
    'Less: lost products',
    '',
    `${team.totals.lostProducts} lost unit${team.totals.lostProducts === 1 ? '' : 's'}`,
    '',
    `${Math.round(team.lostShare * 100)}% of highest loss in your world`,
    team.lostPoints > 0 ? `-${team.lostPoints.toFixed(1)}` : '0.0',
  ]);

  // Subtotal row
  table1Body.push([
    { content: 'Subtotal', styles: { fontStyle: 'bold' } },
    '',
    '',
    '',
    '',
    { content: `${team.subtotal.toFixed(1)}%`, styles: { fontStyle: 'bold' } },
  ]);

  // Class adjustment row
  const adjText = team.adjustmentReason
    ? `Class adjustment (${team.adjustmentReason})`
    : 'Class adjustment';
  table1Body.push([
    adjText,
    '',
    '',
    '',
    '',
    formatPoints(team.adjustmentPoints),
  ]);

  // TOTAL MARK row
  table1Body.push([
    { content: 'TOTAL MARK', styles: { fontStyle: 'bold', fontSize: 10, fillColor: [224, 242, 254], textColor: [3, 105, 161] } },
    { content: '', styles: { fillColor: [224, 242, 254] } },
    { content: '', styles: { fillColor: [224, 242, 254] } },
    { content: '', styles: { fillColor: [224, 242, 254] } },
    { content: '', styles: { fillColor: [224, 242, 254] } },
    { content: `${Math.round(team.totalClamped)}%`, styles: { fontStyle: 'bold', fontSize: 11, fillColor: [224, 242, 254], textColor: [3, 105, 161] } },
  ]);

  autoTable(doc, {
    startY: 37,
    head: table1Head,
    body: table1Body,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, cellPadding: 2.5 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'left' },
      5: { halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  let finalY = (doc as any).lastAutoTable.finalY || 120;

  // Table 2 — Performance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Performance', margin, finalY + 8);

  const table2Head = [['Criterion', 'Total']];
  const table2Body: any[] = [];

  MARKS_CRITERIA.forEach(crit => {
    const tot = team.totals[crit.key];
    const displayTot = crit.format === 'currency' ? formatCurrency(tot) : tot.toString();
    table2Body.push([crit.label, displayTot]);
  });

  // Lost products row
  table2Body.push(['Lost products', team.totals.lostProducts.toString()]);

  autoTable(doc, {
    startY: finalY + 11,
    head: table2Head,
    body: table2Body,
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  finalY = (doc as any).lastAutoTable.finalY || 180;

  // Methodology Note (v1.1 Patch text)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const methodText = "Each criterion is totalled across rounds. For each criterion we calculate the world average and standard deviation across the teams in this world, and express each team's total as a number of standard deviations above or below the average (z). The weighted z-scores are combined using the criterion weights. The mark is the average mark plus the marks-per-standard-deviation multiplied by the combined z-score. Lost products are a penalty only: the team with the most lost products loses the full penalty, others lose a share in proportion to their losses. Wifi carry-over removes lost products only in rounds where the Permanent Tech Benefits rule was on. Class adjustments are added last and the mark is limited to 0–100%.";
  const splitMethod = doc.splitTextToSize(methodText, pageWidth - (margin * 2));
  doc.text(splitMethod, margin, finalY + 8);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${className} · ${team.teamName} · Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  const filename = `SyndicateMarks_${sanitizeFilename(className)}_${sanitizeFilename(team.teamName)}_R${world.asAtRound}.pdf`;
  doc.save(filename);
}

/** Batch export all team PDFs sequentially with progress callback (§8.3). */
export async function exportAllTeamPdfs(
  world: WorldMarksResult,
  className: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const scoredTeams = world.teams.filter(t => !t.excluded);
  for (let i = 0; i < scoredTeams.length; i++) {
    if (onProgress) onProgress(i + 1, scoredTeams.length);
    await generateTeamMarksPdf(scoredTeams[i], world, className);
    await new Promise(r => setTimeout(r, 250));
  }
}

/** Export facilitator-only world summary PDF (landscape, all teams, v1.1 StdDev format) (§8.4). */
export async function exportFacilitatorWorldSummaryPdf(
  world: WorldMarksResult,
  className: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(`Syndicate Marks Summary - ${className}`, margin, 14);

  // Red Badge / Notice
  doc.setFontSize(10);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text('FACILITATOR COPY - contains all teams', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const avgMarkVal = world.teams[0]?.averageMark ?? 65;
  const statusText = `${world.isFinal ? `Final - Round ${world.asAtRound}` : `Marks as at end of Round ${world.asAtRound}`} - Settings: Average mark = ${avgMarkVal}%, Marks per SD = 10`;
  doc.text(statusText, margin, 25);

  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, 14, { align: 'right' });

  // Grid of all teams
  const head = [['Team', 'Revenue (z/m)', 'Control (z/m)', 'Offices (z/m)', 'Techs (z/m)', 'Patents (z/m)', 'Lost (pts)', 'Subtotal', 'Adj (pp)', 'TOTAL']];
  const body = world.teams.map(t => {
    if (t.excluded) {
      return [
        `Team ${t.teamNumber}: ${t.teamName}${t.isBot ? ' (Bot)' : ''} [EXCLUDED]`,
        '-', '-', '-', '-', '-', '-', '-', '-', '0%'
      ];
    }
    return [
      `Team ${t.teamNumber}: ${t.teamName}${t.isBot ? ' (Bot)' : ''}`,
      `${t.zScores.revenue > 0 ? '+' : ''}${t.zScores.revenue.toFixed(1)} SD (${formatMarksContrib(t.contributions.revenue)})`,
      `${t.zScores.controlledRegions > 0 ? '+' : ''}${t.zScores.controlledRegions.toFixed(1)} SD (${formatMarksContrib(t.contributions.controlledRegions)})`,
      `${t.zScores.offices > 0 ? '+' : ''}${t.zScores.offices.toFixed(1)} SD (${formatMarksContrib(t.contributions.offices)})`,
      `${t.zScores.technologies > 0 ? '+' : ''}${t.zScores.technologies.toFixed(1)} SD (${formatMarksContrib(t.contributions.technologies)})`,
      `${t.zScores.patents > 0 ? '+' : ''}${t.zScores.patents.toFixed(1)} SD (${formatMarksContrib(t.contributions.patents)})`,
      `-${t.lostPoints.toFixed(1)}`,
      `${t.subtotal.toFixed(1)}%`,
      formatPoints(t.adjustmentPoints),
      `${Math.round(t.totalClamped)}%`,
    ];
  });

  // World average row
  body.push([
    'World Average / SD',
    `$${Math.round(world.means.revenue).toLocaleString()} / ${world.sds.revenue.toFixed(1)}`,
    `${world.means.controlledRegions.toFixed(1)} / ${world.sds.controlledRegions.toFixed(1)}`,
    `${world.means.offices.toFixed(1)} / ${world.sds.offices.toFixed(1)}`,
    `${world.means.technologies.toFixed(1)} / ${world.sds.technologies.toFixed(1)}`,
    `${world.means.patents.toFixed(1)} / ${world.sds.patents.toFixed(1)}`,
    '-',
    '-',
    '-',
    '-'
  ]);

  autoTable(doc, {
    startY: 29,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'right' },
      9: { halign: 'right', fontStyle: 'bold', textColor: [3, 105, 161] },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${className} · Facilitator Summary · Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  const filename = `SyndicateMarks_${sanitizeFilename(className)}_R${world.asAtRound}_FACILITATOR.pdf`;
  doc.save(filename);
}
