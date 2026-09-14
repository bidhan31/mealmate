import { useCallback, useEffect, useState } from 'react';
import { dashboardApi, dueApi, monthEndApi } from '@/api/financeApi';
import { useAppSelector } from '@/app/hooks';
import { currentCycle, taka } from '@/lib/format';
import type { DashboardSummary, DuesSummary, MemberDueRow, CycleStatusDto } from '@/types/finance';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import {
  FileText,
  Printer,
  User,
  Home as HomeIcon,
  Receipt,
  Download,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Building,
  PieChart,
  ShieldCheck,
  CreditCard,
  Layers,
  UtensilsCrossed,
  FileSpreadsheet,
  FileCode,
  ChevronDown,
} from 'lucide-react';

import { SettlementModal } from '@/components/finance/SettlementModal';

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV(filename: string, rows: (string | number)[][]) {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ReportsPage() {
  const home = useAppSelector((s) => s.home.home);
  const defaultCycle = home?.currentCycle;
  const [cycle, setCycle] = useState(defaultCycle || currentCycle());
  const [reportType, setReportType] = useState<'home' | 'individual'>('home');
  const [selectedMember, setSelectedMember] = useState<string>('');

  const [dashData, setDashData] = useState<DashboardSummary | null>(null);
  const [duesData, setDuesData] = useState<DuesSummary | null>(null);
  const [cycleStatus, setCycleStatus] = useState<CycleStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const [settlementMember, setSettlementMember] = useState<MemberDueRow | null>(null);
  const [settlementMode, setSettlementMode] = useState<'collect' | 'refund'>('collect');
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const handleOpenSettlement = (m: MemberDueRow, mode: 'collect' | 'refund') => {
    setSettlementMember(m);
    setSettlementMode(mode);
    setIsSettlementOpen(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, duesRes, statusRes] = await Promise.all([
        dashboardApi.summary(cycle),
        dueApi.list(cycle),
        monthEndApi.status(cycle).catch(() => ({ data: { data: null } })),
      ]);
      setDashData(dashRes.data.data);
      setDuesData(duesRes.data.data);
      setCycleStatus(statusRes.data?.data ?? null);

      if (duesRes.data.data.members.length > 0 && !selectedMember) {
        setSelectedMember(duesRes.data.data.members[0].membershipId);
      }
    } catch (e) {
      const x = e as { response?: { data?: { message?: string } } };
      setError(x.response?.data?.message ?? 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [cycle, selectedMember]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = () => {
    window.print();
  };

  const selectedMemberData: MemberDueRow | undefined = duesData?.members.find(
    (m) => m.membershipId === selectedMember,
  );

  const formatRoomName = (r?: string | null) => {
    if (!r) return null;
    // Hide raw 24-character hexadecimal MongoDB ObjectIds
    if (/^[0-9a-fA-F]{24}$/.test(r)) return null;
    return r;
  };

  const handleExportCSV = () => {
    if (reportType === 'home' && duesData) {
      const headers = [
        'Member Name',
        'Room',
        'Meals Consumed',
        'Meal Cost (BDT)',
        'Rent Share (BDT)',
        'Utility Share (BDT)',
        'Individual Expenses (BDT)',
        'Total Charges (BDT)',
        'Food Purchases (BDT)',
        'Deposits Paid (BDT)',
        'Carried Over (BDT)',
        'Total Credit (BDT)',
        'Net Settlement (BDT)',
        'Status',
      ];
      const rows = duesData.members.map((m) => [
        m.userName,
        formatRoomName(m.roomId) || 'Unassigned',
        m.mealCount,
        m.mealCost,
        m.rentShare,
        m.utilityShare,
        m.individualShare,
        m.charge,
        m.foodPurchases,
        m.deposits,
        m.carriedOverBalance,
        m.credit,
        m.due,
        m.due > 0 ? 'Owes' : m.due < 0 ? 'Advance' : 'Settled',
      ]);
      exportCSV(`Whole_Home_Report_${cycle}.csv`, [headers, ...rows]);
    } else if (reportType === 'individual' && selectedMemberData) {
      const m = selectedMemberData;
      const headers = ['Category / Item', 'Type', 'Amount (BDT)', 'Details / Note'];
      const rows = [
        ['Meals Consumed', 'Debit Obligation', m.mealCost, `${m.mealCount} meals @ ${taka(duesData?.mealRate || 0)}/meal`],
        ['Rent Share', 'Debit Obligation', m.rentShare, 'Equally shared room rent'],
        ['Utility Share', 'Debit Obligation', m.utilityShare, 'Equally shared utilities & overhead'],
        ['Individual Direct Expenses', 'Debit Obligation', m.individualShare, 'Direct personal charges'],
        ['Food Purchases Contribution', 'Credit Paid', m.foodPurchases, 'Grocery/Bazaar purchased by member'],
        ['Deposits Paid', 'Credit Paid', m.deposits, 'Direct deposits / payments recorded'],
        ['Carried Over Credit/Balance', 'Credit Adjustment', m.carriedOverBalance, 'Brought forward from previous cycle'],
        ['TOTAL DEBIT CHARGES', 'Summary', m.charge, 'Total Obligations'],
        ['TOTAL CREDIT PAID', 'Summary', m.credit, 'Total Payments/Contributions'],
        ['NET SETTLEMENT BALANCE', 'Final', m.due, m.due > 0 ? 'Outstanding Owes' : m.due < 0 ? 'Advance Refundable' : 'Fully Settled'],
      ];
      exportCSV(`Member_Statement_${m.userName.replace(/\s+/g, '_')}_${cycle}.csv`, [headers, ...rows]);
    }
  };

  const handleExportJSON = () => {
    if (reportType === 'home' && duesData) {
      const payload = {
        homeName: home?.name || 'Mess Home',
        billingCycle: cycle,
        generatedAt: new Date().toISOString(),
        summary: {
          totalMeals: duesData.homeTotalMeals,
          mealRate: duesData.mealRate,
          totalFoodPurchases: duesData.totalFoodPurchases,
          totalFixedExpenses: duesData.totalFixedExpenses,
          totalDeposits: duesData.totalDeposits,
          activeMemberCount: duesData.activeMemberCount,
          totalOutstandingDues: dashData?.dues.totalOutstanding || 0,
          totalAdvanceCredits: dashData?.dues.totalAdvance || 0,
        },
        members: duesData.members.map((m) => ({
          name: m.userName,
          room: formatRoomName(m.roomId) || 'Unassigned',
          meals: m.mealCount,
          mealCost: m.mealCost,
          rentShare: m.rentShare,
          utilityShare: m.utilityShare,
          individualShare: m.individualShare,
          totalCharges: m.charge,
          foodSpent: m.foodPurchases,
          depositsPaid: m.deposits,
          carriedOverBalance: m.carriedOverBalance,
          totalCredit: m.credit,
          netSettlement: m.due,
          status: m.due > 0 ? 'Owes' : m.due < 0 ? 'Advance' : 'Settled',
        })),
      };
      downloadFile(`Whole_Home_Report_${cycle}.json`, JSON.stringify(payload, null, 2), 'application/json');
    } else if (reportType === 'individual' && selectedMemberData) {
      const m = selectedMemberData;
      const payload = {
        homeName: home?.name || 'Mess Home',
        memberName: m.userName,
        room: formatRoomName(m.roomId) || 'Unassigned',
        billingCycle: cycle,
        generatedAt: new Date().toISOString(),
        statement: {
          mealsConsumed: m.mealCount,
          mealRate: duesData?.mealRate || 0,
          mealCost: m.mealCost,
          rentShare: m.rentShare,
          utilityShare: m.utilityShare,
          individualShare: m.individualShare,
          totalObligations: m.charge,
          foodPurchasesContribution: m.foodPurchases,
          depositsPaid: m.deposits,
          carriedOverBalance: m.carriedOverBalance,
          totalCredit: m.credit,
          netSettlementBalance: m.due,
          status: m.due > 0 ? 'Owes' : m.due < 0 ? 'Advance' : 'Settled',
        },
      };
      downloadFile(
        `Member_Statement_${m.userName.replace(/\s+/g, '_')}_${cycle}.json`,
        JSON.stringify(payload, null, 2),
        'application/json',
      );
    }
  };

  const buildReportHTML = (isPdf = false) => {
    if (reportType === 'home' && duesData) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Whole Home Financial Statement - ${cycle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: ${isPdf ? '0' : '32px'};
      background-color: ${isPdf ? '#ffffff' : '#f8fafc'};
      color: #0f172a;
      line-height: 1.5;
    }
    .report-card {
      max-width: 1000px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: ${isPdf ? '0' : '16px'};
      box-shadow: ${isPdf ? 'none' : '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'};
      padding: ${isPdf ? '16px' : '36px'};
      border: ${isPdf ? 'none' : '1px solid #e2e8f0'};
    }
    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand-title {
      color: #4f46e5;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: -0.01em;
    }
    .report-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 4px 0 0 0;
      letter-spacing: -0.02em;
    }
    .report-sub {
      color: #64748b;
      font-size: 13px;
      margin-top: 4px;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 12px;
      text-align: right;
      line-height: 1.6;
    }
    .meta-box strong { color: #0f172a; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      padding: 14px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .kpi-card.meals { border-left: 4px solid #6366f1; background: #eef2ff; }
    .kpi-card.food { border-left: 4px solid #10b981; background: #ecfdf5; }
    .kpi-card.fixed { border-left: 4px solid #0284c7; background: #f0f9ff; }
    .kpi-card.deposits { border-left: 4px solid #8b5cf6; background: #faf5ff; }
    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    .kpi-value {
      font-size: 22px;
      font-weight: 800;
      margin-top: 4px;
      color: #0f172a;
    }
    .kpi-foot {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    th {
      background: #1e293b;
      color: #ffffff;
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    td {
      padding: 10px 12px;
      font-size: 12.5px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tr:nth-child(even) { background-color: #f8fafc; }
    tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .bold { font-weight: 700; color: #0f172a; }
    .badge-owes {
      color: #dc2626;
      font-weight: 700;
      background: #fee2e2;
      padding: 2px 8px;
      border-radius: 999px;
      display: inline-block;
    }
    .badge-advance {
      color: #059669;
      font-weight: 700;
      background: #d1fae5;
      padding: 2px 8px;
      border-radius: 999px;
      display: inline-block;
    }
    .badge-settled { color: #64748b; font-weight: 600; }
    .totals-row {
      background: #0f172a !important;
      color: #ffffff !important;
      font-weight: 700;
    }
    .totals-row td {
      color: #ffffff !important;
      border-top: 2px solid #334155;
    }
    .footer-sigs {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
    }
    @page { size: auto; margin: 10mm; }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header-banner">
      <div>
        <div class="brand-title">MealMate Mess Management</div>
        <h1 class="report-title">Whole Home Financial Statement</h1>
        <div class="report-sub">Comprehensive Cost Allocation & Settlement Audit</div>
      </div>
      <div class="meta-box">
        <div>House Name: <strong>${home?.name || 'Mess Home'}</strong></div>
        <div>Billing Cycle: <strong>${formatCycleMonth(cycle)} (${cycle})</strong></div>
        <div>Report Ref ID: <strong>MM-REP-${cycle.replace('-', '')}</strong></div>
        <div>Generated: ${new Date().toLocaleString()}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card meals">
        <div class="kpi-label">Total Meals</div>
        <div class="kpi-value">${duesData.homeTotalMeals}</div>
        <div class="kpi-foot">Meal Rate: <strong>৳${duesData.mealRate}</strong>/meal</div>
      </div>
      <div class="kpi-card food">
        <div class="kpi-label">Total Food Costs</div>
        <div class="kpi-value">৳${duesData.totalFoodPurchases}</div>
        <div class="kpi-foot">Bazaar Expenditures</div>
      </div>
      <div class="kpi-card fixed">
        <div class="kpi-label">Fixed & Overhead</div>
        <div class="kpi-value">৳${duesData.totalFixedExpenses}</div>
        <div class="kpi-foot">Rent, Utilities & Shared</div>
      </div>
      <div class="kpi-card deposits">
        <div class="kpi-label">Member Deposits</div>
        <div class="kpi-value">৳${duesData.totalDeposits}</div>
        <div class="kpi-foot">${duesData.activeMemberCount} Active Members</div>
      </div>
    </div>

    <h3 style="font-size:12px; font-weight:700; text-transform:uppercase; color:#475569; letter-spacing:0.05em; margin: 20px 0 8px 0;">Master Member Settlement Ledger</h3>
    <table>
      <thead>
        <tr>
          <th>Member & Room</th>
          <th class="text-center">Meals</th>
          <th class="text-right">Meal Cost</th>
          <th class="text-right">Rent Share</th>
          <th class="text-right">Utility Share</th>
          <th class="text-right">Direct/Indiv.</th>
          <th class="text-right">Total Charges</th>
          <th class="text-right">Food Spent</th>
          <th class="text-right">Deposits Paid</th>
          <th class="text-right">Net Settlement</th>
        </tr>
      </thead>
      <tbody>
        ${duesData.members
          .map(
            (m) => `
          <tr>
            <td><strong>${m.userName}</strong>${formatRoomName(m.roomId) ? `<br><span style="color:#64748b; font-size:11px;">${formatRoomName(m.roomId)}</span>` : ''}</td>
            <td class="text-center">${m.mealCount}</td>
            <td class="text-right">৳${m.mealCost}</td>
            <td class="text-right">৳${m.rentShare}</td>
            <td class="text-right">৳${m.utilityShare}</td>
            <td class="text-right">৳${m.individualShare}</td>
            <td class="text-right bold" style="background:#f5f3ff;">৳${m.charge}</td>
            <td class="text-right">৳${m.foodPurchases}</td>
            <td class="text-right">৳${m.deposits}</td>
            <td class="text-right">
              <span class="${m.due > 0 ? 'badge-owes' : m.due < 0 ? 'badge-advance' : 'badge-settled'}">
                ${m.due > 0 ? `Owes ৳${m.due}` : m.due < 0 ? `Advance ৳${Math.abs(m.due)}` : 'Settled'}
              </span>
            </td>
          </tr>
        `,
          )
          .join('')}
        <tr class="totals-row">
          <td>TOTALS (${duesData.activeMemberCount})</td>
          <td class="text-center">${duesData.homeTotalMeals}</td>
          <td class="text-right">৳${duesData.members.reduce((acc, m) => acc + m.mealCost, 0)}</td>
          <td class="text-right">৳${duesData.members.reduce((acc, m) => acc + m.rentShare, 0)}</td>
          <td class="text-right">৳${duesData.members.reduce((acc, m) => acc + m.utilityShare, 0)}</td>
          <td class="text-right">৳${duesData.members.reduce((acc, m) => acc + m.individualShare, 0)}</td>
          <td class="text-right">৳${duesData.members.reduce((acc, m) => acc + m.charge, 0)}</td>
          <td class="text-right">৳${duesData.totalFoodPurchases}</td>
          <td class="text-right">৳${duesData.totalDeposits}</td>
          <td class="text-right" style="color:#a5b4fc;">৳${(dashData?.dues.totalOutstanding || 0) - (dashData?.dues.totalAdvance || 0)}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-sigs">
      <div>Prepared by Mess Manager / Admin<br><br>__________________________<br>Signature & Date</div>
      <div style="text-align:right;">Verified by Committee Auditor<br><br>__________________________<br>Signature & Date</div>
    </div>
  </div>
</body>
</html>`;
    } else if (reportType === 'individual' && selectedMemberData && duesData) {
      const m = selectedMemberData;
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Member Statement - ${m.userName} - ${cycle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: ${isPdf ? '0' : '32px'};
      background-color: ${isPdf ? '#ffffff' : '#f8fafc'};
      color: #0f172a;
      line-height: 1.5;
    }
    .report-card {
      max-width: 1000px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: ${isPdf ? '0' : '16px'};
      box-shadow: ${isPdf ? 'none' : '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'};
      padding: ${isPdf ? '16px' : '36px'};
      border: ${isPdf ? 'none' : '1px solid #e2e8f0'};
    }
    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand-title {
      color: #4f46e5;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: -0.01em;
    }
    .report-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 4px 0 0 0;
      letter-spacing: -0.02em;
    }
    .report-sub {
      color: #64748b;
      font-size: 13px;
      margin-top: 4px;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 12px;
      text-align: right;
      line-height: 1.6;
    }
    .meta-box strong { color: #0f172a; }
    .status-banner {
      padding: 16px 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-banner.owes {
      background: #fef2f2;
      border: 1px solid #fecdd3;
      color: #9f1239;
    }
    .status-banner.advance {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .status-banner.settled {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      padding: 14px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .kpi-card.meals { border-left: 4px solid #6366f1; background: #eef2ff; }
    .kpi-card.fixed { border-left: 4px solid #0284c7; background: #f0f9ff; }
    .kpi-card.obli { border-left: 4px solid #f59e0b; background: #fffbeb; }
    .kpi-card.credits { border-left: 4px solid #10b981; background: #ecfdf5; }
    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    .kpi-value {
      font-size: 22px;
      font-weight: 800;
      margin-top: 4px;
      color: #0f172a;
    }
    .kpi-foot {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    th {
      background: #1e293b;
      color: #ffffff;
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    td {
      padding: 10px 12px;
      font-size: 12.5px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tr:nth-child(even) { background-color: #f8fafc; }
    tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .bold { font-weight: 700; color: #0f172a; }
    .totals-row {
      background: #0f172a !important;
      color: #ffffff !important;
      font-weight: 700;
    }
    .totals-row td {
      color: #ffffff !important;
      border-top: 2px solid #334155;
    }
    .footer-sigs {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
    }
    @page { size: auto; margin: 10mm; }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header-banner">
      <div>
        <div class="brand-title">Member Statement of Account</div>
        <h1 class="report-title">${m.userName}</h1>
        <div class="report-sub">Room: <strong>${formatRoomName(m.roomId) || 'Unassigned'}</strong></div>
      </div>
      <div class="meta-box">
        <div>House Name: <strong>${home?.name || 'Mess Home'}</strong></div>
        <div>Statement Period: <strong>${formatCycleMonth(cycle)}</strong></div>
        <div>Generated: ${new Date().toLocaleDateString('en-US', { 
  // weekday: 'long', 
  // year: 'numeric', 
  month: 'short', 
  day: 'numeric'
})}</div>
      </div>
    </div>

    <div class="status-banner ${m.due > 0 ? 'owes' : m.due < 0 ? 'advance' : 'settled'}">
      <div>
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; opacity:0.8;">Final Settlement Status</div>
        <div style="font-size:18px; font-weight:800; margin-top:2px;">
          ${m.due > 0 ? `Outstanding Amount Owes: ৳${m.due}` : m.due < 0 ? `Advance Credit / Refundable: ৳${Math.abs(m.due)}` : 'Account Fully Settled (৳0 Due)'}
        </div>
      </div>
      <div style="font-size:12px; font-weight:600;">
        ${m.due > 0 ? 'Please clear dues before cycle close' : m.due < 0 ? 'Credit balance carried forward' : 'All obligations & credits balanced'}
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card meals">
        <div class="kpi-label">Meals Consumed</div>
        <div class="kpi-value">${m.mealCount}</div>
        <div class="kpi-foot">Cost: ৳${m.mealCost}</div>
      </div>
      <div class="kpi-card fixed">
        <div class="kpi-label">Fixed & Utility Share</div>
        <div class="kpi-value">৳${m.rentShare + m.utilityShare}</div>
        <div class="kpi-foot">Rent: ৳${m.rentShare} | Util: ৳${m.utilityShare}</div>
      </div>
      <div class="kpi-card obli">
        <div class="kpi-label">Total Obligations</div>
        <div class="kpi-value">৳${m.charge}</div>
        <div class="kpi-foot">Gross Debit Charges</div>
      </div>
      <div class="kpi-card credits">
        <div class="kpi-label">Total Paid & Credits</div>
        <div class="kpi-value" style="color:#059669;">৳${m.credit}</div>
        <div class="kpi-foot">Deposits + Food Spent</div>
      </div>
    </div>

    <h3 style="font-size:12px; font-weight:700; text-transform:uppercase; color:#475569; letter-spacing:0.05em; margin: 20px 0 8px 0;">Itemized Statement Breakdown</h3>
    <table>
      <thead>
        <tr><th>Item Description / Category</th><th>Type</th><th class="text-right">Debit Charge</th><th class="text-right">Credit Paid</th></tr>
      </thead>
      <tbody>
        <tr><td>Meal Expenses (${m.mealCount} meals @ ৳${duesData.mealRate}/meal)</td><td>Variable Food</td><td class="text-right bold">৳${m.mealCost}</td><td class="text-right">—</td></tr>
        <tr><td>Equally Shared Room Rent</td><td>Fixed Overhead</td><td class="text-right bold">৳${m.rentShare}</td><td class="text-right">—</td></tr>
        <tr><td>Utilities & Shared Expenses Share</td><td>Fixed Overhead</td><td class="text-right bold">৳${m.utilityShare}</td><td class="text-right">—</td></tr>
        ${m.individualShare > 0 ? `<tr><td>Direct Individual Charges</td><td>Personal Expense</td><td class="text-right bold">৳${m.individualShare}</td><td class="text-right">—</td></tr>` : ''}
        ${m.foodPurchases > 0 ? `<tr><td>Food Purchases Contribution</td><td>Bazaar Contribution</td><td class="text-right">—</td><td class="text-right bold" style="color:#059669;">৳${m.foodPurchases}</td></tr>` : ''}
        ${m.deposits > 0 ? `<tr><td>Direct Cash/Bank Deposits Paid</td><td>Member Payment</td><td class="text-right">—</td><td class="text-right bold" style="color:#059669;">৳${m.deposits}</td></tr>` : ''}
        ${m.carriedOverBalance !== 0 ? `<tr><td>Carried Over Credit / Balance</td><td>Balance Adjustment</td><td class="text-right bold">${m.carriedOverBalance > 0 ? `৳${m.carriedOverBalance}` : '—'}</td><td class="text-right bold" style="color:#059669;">${m.carriedOverBalance < 0 ? `৳${Math.abs(m.carriedOverBalance)}` : '—'}</td></tr>` : ''}
        <tr class="totals-row"><td>TOTALS</td><td></td><td class="text-right">৳${m.charge}</td><td class="text-right" style="color:#a7f3d0;">৳${m.credit}</td></tr>
      </tbody>
    </table>

    <div class="footer-sigs">
      <div>Member Acknowledgment & Signature<br><br>__________________________<br>${m.userName}</div>
      <div style="text-align:right;">Mess Manager Sign-off<br><br>__________________________<br>Authorized Admin</div>
    </div>
  </div>
</body>
</html>`;
    }
    return '';
  };

  const handleExportHTML = () => {
    const htmlContent = buildReportHTML(false);
    if (!htmlContent) return;
    const filename =
      reportType === 'home'
        ? `Whole_Home_Report_${cycle}.html`
        : `Member_Statement_${selectedMemberData?.userName.replace(/\s+/g, '_') || 'Member'}_${cycle}.html`;
    downloadFile(filename, htmlContent, 'text/html');
  };

  const handleExportPDF = () => {
    const htmlContent = buildReportHTML(true);
    if (!htmlContent) return;

    const printWindow = window.open('', '_blank', 'width=950,height=1150');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const formatCycleMonth = (c: string) => {
    try {
      const [year, month] = c.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return c;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header (Control Bar) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Financial & Audit Reports
          </h2>
          <p className="text-muted-foreground text-sm">
            Generate, print, and export industry-grade audit statements & member ledgers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadOpen((o) => !o)}
              disabled={!dashData && !duesData}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Report
              <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-70" />
            </Button>
            {downloadOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-card shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => {
                    handleExportPDF();
                    setDownloadOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <Printer className="w-4 h-4 text-red-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">PDF Document (.pdf)</p>
                    <p className="text-[10px] text-muted-foreground">Print &amp; Save as PDF</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportCSV();
                    setDownloadOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Spreadsheet (.csv)</p>
                    <p className="text-[10px] text-muted-foreground">Excel &amp; Google Sheets</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportHTML();
                    setDownloadOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Standalone Web Page (.html)</p>
                    <p className="text-[10px] text-muted-foreground">Offline printable document</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportJSON();
                    setDownloadOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <FileCode className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Audit Data Payload (.json)</p>
                    <p className="text-[10px] text-muted-foreground">Raw structured JSON data</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <Button variant="default" size="sm" onClick={handlePrint} disabled={!dashData && !duesData}>
            <Printer className="w-4 h-4 mr-2" />
            Print / PDF Report
          </Button>
        </div>
      
      </div>
        {/* Filter and Selection Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border print:hidden shadow-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-44">
              <Input
                id="cycle"
                type="month"
                label="Billing Cycle"
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
              />
            </div>
            <div className="flex items-center bg-muted p-1 rounded-xl border border-border">
              <button
                onClick={() => setReportType('home')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  reportType === 'home'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <HomeIcon className="w-4 h-4 text-primary" />
                Whole Home Audit
              </button>
              <button
                onClick={() => setReportType('individual')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  reportType === 'individual'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="w-4 h-4 text-primary" />
                Member Statement
              </button>
            </div>

            {reportType === 'individual' && duesData && (
              <div className="w-64">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Select Member</label>
                <select
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                >
                  {duesData.members.map((m) => (
                    <option key={m.membershipId} value={m.membershipId}>
                      {m.userName} {formatRoomName(m.roomId) ? `(${formatRoomName(m.roomId)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {cycleStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-muted/40">
              <span
                className={`h-2 w-2 rounded-full ${
                  cycleStatus.status === 'closed' ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
                }`}
              />
              <span className="capitalize">Cycle Status: {cycleStatus.status}</span>
            </div>
          )}
        </div>


      {error && <p className="rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">{error}</p>}

      {loading && (
        <div className="text-center py-12 space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground font-medium">Generating financial audit report...</p>
        </div>
      )}

      {/* Printable Report Container */}
      {!loading && (
        <div className="report-container bg-card rounded-2xl border border-border shadow-sm p-8 md:p-10 print:p-0 print:border-none print:shadow-none print:bg-white text-card-foreground">
          {/* ========================================================================= */}
          {/* WHOLE HOME AUDIT REPORT */}
          {/* ========================================================================= */}
          {reportType === 'home' && duesData && dashData && (
            <div className="space-y-8">
              {/* Report Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-6 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
                    <UtensilsCrossed className="w-6 h-6" />
                    <span>MealMate Mess Management</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                    Whole Home Financial Statement
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Comprehensive Cost Allocation & Settlement Audit
                  </p>
                </div>
                <div className="text-left md:text-right bg-muted/40 p-3 rounded-xl border border-border text-xs space-y-1">
                  <p><span className="font-semibold text-muted-foreground">House Name:</span> <span className="font-bold">{home?.name || 'Mess Home'}</span></p>
                  <p><span className="font-semibold text-muted-foreground">Billing Cycle:</span> <span className="font-bold">{formatCycleMonth(cycle)} ({cycle})</span></p>
                  <p><span className="font-semibold text-muted-foreground">Report Ref ID:</span> <span className="font-mono">MM-REP-{
                  new Date()
                  .toLocaleString()
                  .replaceAll('-', '')
                  .replaceAll(' ', '')
                  .replaceAll('/', '')
                  .replaceAll('A', '')
                  .replaceAll('P', '')
                  .replaceAll('M', '')
                  .replaceAll(',', '')
                  .replaceAll(':', '')
                  }</span></p>
                  <p><span className="font-semibold text-muted-foreground">Generated On:</span> {
                  new Date().toLocaleDateString('en-US', {
                    year :'numeric', month: 'short', day: 'numeric' ,hour:'2-digit',minute:'2-digit',hour12: true
                    })}</p>
                </div>
              </div>

              {/* Executive KPI Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-primary" />
                  Executive Financial Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs font-semibold">Total Meals</span>
                      <UtensilsCrossed className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-2xl font-bold mt-2">{duesData.homeTotalMeals}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Meal Rate: <span className="font-bold text-foreground">{taka(duesData.mealRate)}</span>/meal
                    </p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs font-semibold">Total Food Costs</span>
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-bold mt-2">{taka(duesData.totalFoodPurchases)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Bazaar / Grocery Expenditures</p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs font-semibold">Fixed & Overhead</span>
                      <Layers className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold mt-2">{taka(duesData.totalFixedExpenses)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Rent, Utilities & Shared Costs</p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs font-semibold">Total Member Deposits</span>
                      <CreditCard className="w-4 h-4 text-indigo-500" />
                    </div>
                    <p className="text-2xl font-bold mt-2">{taka(duesData.totalDeposits)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{duesData.activeMemberCount} Active Members</p>
                  </div>
                </div>
              </div>

              {/* Settlement Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-destructive/5 border-destructive/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-destructive opacity-90">Total Outstanding Dues</p>
                    <p className="text-xl font-bold text-destructive mt-0.5">{taka(dashData.dues.totalOutstanding)}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-destructive/40" />
                </div>
                <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-600 opacity-90">Total Advance Credits</p>
                    <p className="text-xl font-bold text-emerald-600 mt-0.5">{taka(dashData.dues.totalAdvance)}</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
                </div>
                <div className="p-4 rounded-xl border bg-muted/30 border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Members in Pending Due</p>
                    <p className="text-xl font-bold text-foreground mt-0.5">{dashData.dues.membersInDue} / {duesData.activeMemberCount}</p>
                  </div>
                  <User className="w-8 h-8 text-muted-foreground/40" />
                </div>
              </div>

              {/* Shared Overhead Breakdown */}
              {dashData.expenseByType && dashData.expenseByType.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-primary" />
                    Overhead Expense Category Distribution
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {dashData.expenseByType.map((cat) => (
                      <div key={cat.type} className="p-3 rounded-lg border border-border bg-muted/20 flex justify-between items-center">
                        <span className="text-xs font-medium capitalize text-muted-foreground">{cat.type.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-bold">{taka(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Master Settlement Ledger Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Master Member Settlement Ledger
                  </h3>
                  <span className="text-xs text-muted-foreground">Amounts in BDT (৳)</span>
                </div>

                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-semibold text-xs">Member & Room</TableHead>
                        <TableHead className="text-center font-semibold text-xs">Meals</TableHead>
                        <TableHead className="text-right font-semibold text-xs">Meal Cost</TableHead>
                        <TableHead className="text-right font-semibold text-xs">Rent Share</TableHead>
                        <TableHead className="text-right font-semibold text-xs">Utility Share</TableHead>
                        <TableHead className="text-right font-semibold text-xs">Direct/Indiv.</TableHead>
                        <TableHead className="text-right font-semibold text-xs bg-muted/80">Total Charges</TableHead>
                        <TableHead className="text-right font-semibold text-xs">Food Spent</TableHead>
                        <TableHead className="text-right font-semibold text-xs">Deposits Paid</TableHead>
                        <TableHead className="text-right font-semibold text-xs bg-primary/5">Net Settlement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {duesData.members.map((m) => (
                        <TableRow key={m.membershipId} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium text-xs">
                            <div className="font-bold text-foreground">{m.userName}</div>
                            {formatRoomName(m.roomId) && (
                              <div className="text-[11px] text-muted-foreground">{formatRoomName(m.roomId)}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs font-semibold">{m.mealCount}</TableCell>
                          <TableCell className="text-right text-xs">{taka(m.mealCost)}</TableCell>
                          <TableCell className="text-right text-xs">{taka(m.rentShare)}</TableCell>
                          <TableCell className="text-right text-xs">{taka(m.utilityShare)}</TableCell>
                          <TableCell className="text-right text-xs">{taka(m.individualShare)}</TableCell>
                          <TableCell className="text-right text-xs font-bold bg-muted/30">{taka(m.charge)}</TableCell>
                          <TableCell className="text-right text-xs">{taka(m.foodPurchases)}</TableCell>
                          <TableCell className="text-right text-xs">{taka(m.deposits)}</TableCell>
                          <TableCell className={`text-right text-xs font-bold bg-primary/5 ${
                            m.due > 0 ? 'text-destructive cursor-pointer hover:underline' : m.due < 0 ? 'text-emerald-600 font-extrabold cursor-pointer hover:underline' : 'text-muted-foreground'
                          }`}
                          onClick={() => {
                            if (m.due > 0) handleOpenSettlement(m, 'collect');
                            else if (m.due < 0) handleOpenSettlement(m, 'refund');
                          }}
                          title={m.due !== 0 ? 'Click to open settlement modal' : undefined}
                          >
                            {m.due > 0 ? `Owes ${taka(m.due)}` : m.due < 0 ? `Advance ${taka(Math.abs(m.due))}` : 'Settled'}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Ledger Summary / Totals Row */}
                      <TableRow className="bg-muted/70 font-bold border-t-2 border-border">
                        <TableCell className="text-xs">TOTALS ({duesData.activeMemberCount})</TableCell>
                        <TableCell className="text-center text-xs">{duesData.homeTotalMeals}</TableCell>
                        <TableCell className="text-right text-xs">{taka(duesData.members.reduce((acc, m) => acc + m.mealCost, 0))}</TableCell>
                        <TableCell className="text-right text-xs">{taka(duesData.members.reduce((acc, m) => acc + m.rentShare, 0))}</TableCell>
                        <TableCell className="text-right text-xs">{taka(duesData.members.reduce((acc, m) => acc + m.utilityShare, 0))}</TableCell>
                        <TableCell className="text-right text-xs">{taka(duesData.members.reduce((acc, m) => acc + m.individualShare, 0))}</TableCell>
                        <TableCell className="text-right text-xs">{taka(duesData.members.reduce((acc, m) => acc + m.charge, 0))}</TableCell>
                        <TableCell className="text-right text-xs">{taka(duesData.totalFoodPurchases)}</TableCell>
                        <TableCell className="text-right text-xs">{taka(duesData.totalDeposits)}</TableCell>
                        <TableCell className={`text-right text-xs font-bold bg-primary/5 ${
                          dashData.dues.totalOutstanding - dashData.dues.totalAdvance > 0
                            ? 'text-destructive'
                            : dashData.dues.totalOutstanding - dashData.dues.totalAdvance < 0
                            ? 'text-emerald-600 font-extrabold'
                            : 'text-muted-foreground'
                        }`}>
                          {(() => {
                            const net = dashData.dues.totalOutstanding - dashData.dues.totalAdvance;
                            if (net > 0) return `Owes ${taka(net)}`;
                            if (net < 0) return `Advance ${taka(Math.abs(net))}`;
                            return 'Settled';
                          })()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Sign-off & Authorization Section */}
              <div className="pt-8 border-t border-border grid grid-cols-2 gap-8 text-xs text-muted-foreground">
                <div className="space-y-8">
                  <p className="font-semibold text-foreground">Prepared by Mess Manager / Admin:</p>
                  <div className="border-b border-border w-48" />
                  <p>Signature & Date</p>
                </div>
                <div className="space-y-8 text-right flex flex-col items-end">
                  <p className="font-semibold text-foreground">Verified & Approved by Committee:</p>
                  <div className="border-b border-border w-48" />
                  <p>Signature & Date</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* INDIVIDUAL MEMBER STATEMENT OF ACCOUNT */}
          {/* ========================================================================= */}
          {reportType === 'individual' && selectedMemberData && duesData && (
            <div className="space-y-8">
              {/* Statement Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-6 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-tight">
                    <User className="w-5 h-5" />
                    <span>Member Statement of Account</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-foreground">
                    {selectedMemberData.userName}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Room: <span className="font-medium text-foreground">{formatRoomName(selectedMemberData.roomId) || 'Unassigned'}</span>
                  </p>
                </div>

                <div className="text-left md:text-right bg-muted/40 p-3 rounded-xl border border-border text-xs space-y-1">
                  <p><span className="font-semibold text-muted-foreground">Home:</span> <span className="font-bold">{home?.name || 'Mess Home'}</span></p>
                  <p><span className="font-semibold text-muted-foreground">Cycle:</span> <span className="font-bold">{formatCycleMonth(cycle)}</span></p>
                  <p><span className="font-semibold text-muted-foreground">Generated On:</span> {new Date().toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric' ,hour:'2-digit',minute:'2-digit',hour12: true
                    })
                    }</p>
                </div>
              </div>

              {/* Settlement Banner */}
              <div
                className={`p-5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  selectedMemberData.due > 0
                    ? 'bg-destructive/10 border-destructive/30 text-destructive'
                    : selectedMemberData.due < 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                    : 'bg-muted/40 border-border text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  {selectedMemberData.due > 0 ? (
                    <AlertCircle className="w-8 h-8 shrink-0 text-destructive" />
                  ) : selectedMemberData.due < 0 ? (
                    <CheckCircle2 className="w-8 h-8 shrink-0 text-emerald-600" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-xs uppercase font-bold tracking-wider opacity-80">
                      Final Account Settlement Status
                    </p>
                    <p className="text-xl font-extrabold mt-0.5">
                      {selectedMemberData.due > 0
                        ? `Outstanding Amount Owes: ${taka(selectedMemberData.due)}`
                        : selectedMemberData.due < 0
                        ? `Advance Credit / Refundable: ${taka(Math.abs(selectedMemberData.due))}`
                        : 'Account Fully Settled (৳0 Due)'}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs opacity-90 font-medium">
                  {selectedMemberData.due > 0
                    ? 'Please clear dues before month close.'
                    : selectedMemberData.due < 0
                    ? 'Credit balance carried forward.'
                    : 'All charges & payments balanced.'}
                </div>
              </div>

              {/* Member KPI Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/30 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold">Meals Consumed</span>
                  <p className="text-2xl font-bold mt-1 text-foreground">{selectedMemberData.mealCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cost: {taka(selectedMemberData.mealCost)}</p>
                </div>

                <div className="p-4 bg-muted/30 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold">Fixed & Utilities Share</span>
                  <p className="text-2xl font-bold mt-1 text-foreground">{taka(selectedMemberData.rentShare + selectedMemberData.utilityShare)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Rent: {taka(selectedMemberData.rentShare)} | Util: {taka(selectedMemberData.utilityShare)}</p>
                </div>

                <div className="p-4 bg-muted/30 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold">Total Obligations (Debit)</span>
                  <p className="text-2xl font-bold mt-1 text-foreground">{taka(selectedMemberData.charge)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Gross Total Charges</p>
                </div>

                <div className="p-4 bg-muted/30 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-semibold">Total Paid & Credits</span>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">{taka(selectedMemberData.credit)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Deposits + Food Purchases</p>
                </div>
              </div>

              {/* Itemized Statement Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-primary" />
                  Itemized Statement Breakdown
                </h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-semibold text-xs">Item Description / Category</TableHead>
                        <TableHead className="font-semibold text-xs">Type</TableHead>
                        <TableHead className="text-right font-semibold text-xs">Debit Charge</TableHead>
                        <TableHead className="text-right font-semibold text-xs">Credit Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-xs">
                          Meal Expenses ({selectedMemberData.mealCount} meals @ {taka(duesData.mealRate)}/meal)
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">Variable Food</TableCell>
                        <TableCell className="text-right text-xs font-bold">{taka(selectedMemberData.mealCost)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium text-xs">Equally Shared Room Rent</TableCell>
                        <TableCell className="text-xs text-muted-foreground">Fixed Overhead</TableCell>
                        <TableCell className="text-right text-xs font-bold">{taka(selectedMemberData.rentShare)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell className="font-medium text-xs">Utilities & Common Expenses Share</TableCell>
                        <TableCell className="text-xs text-muted-foreground">Fixed Overhead</TableCell>
                        <TableCell className="text-right text-xs font-bold">{taka(selectedMemberData.utilityShare)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                      </TableRow>

                      {selectedMemberData.individualShare > 0 && (
                        <TableRow>
                          <TableCell className="font-medium text-xs">Direct Individual Charges</TableCell>
                          <TableCell className="text-xs text-muted-foreground">Personal Expense</TableCell>
                          <TableCell className="text-right text-xs font-bold">{taka(selectedMemberData.individualShare)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                        </TableRow>
                      )}

                      {selectedMemberData.foodPurchases > 0 && (
                        <TableRow>
                          <TableCell className="font-medium text-xs text-emerald-600">
                            Food & Grocery Purchases Bought by Member
                          </TableCell>
                          <TableCell className="text-xs text-emerald-600 font-medium">Bazaar Contribution</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">{taka(selectedMemberData.foodPurchases)}</TableCell>
                        </TableRow>
                      )}

                      {selectedMemberData.deposits > 0 && (
                        <TableRow>
                          <TableCell className="font-medium text-xs text-emerald-600">
                            Direct Cash/Bank/Mobile Deposits Paid
                          </TableCell>
                          <TableCell className="text-xs text-emerald-600 font-medium">Member Payment</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">{taka(selectedMemberData.deposits)}</TableCell>
                        </TableRow>
                      )}

                      {selectedMemberData.carriedOverBalance !== 0 && (
                        <TableRow>
                          <TableCell className="font-medium text-xs">
                            Carried Over Credit / Balance from Previous Cycle
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">Balance Adjustment</TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {selectedMemberData.carriedOverBalance > 0 ? taka(selectedMemberData.carriedOverBalance) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">
                            {selectedMemberData.carriedOverBalance < 0 ? taka(Math.abs(selectedMemberData.carriedOverBalance)) : '—'}
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Totals Row */}
                      <TableRow className="bg-muted/70 font-bold border-t-2 border-border">
                        <TableCell className="text-xs">TOTALS</TableCell>
                        <TableCell className="text-xs"></TableCell>
                        <TableCell className="text-right text-xs">{taka(selectedMemberData.charge)}</TableCell>
                        <TableCell className="text-right text-xs text-emerald-600">{taka(selectedMemberData.credit)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Sign-off & Member Acknowledgment */}
              <div className="pt-8 border-t border-border grid grid-cols-2 gap-8 text-xs text-muted-foreground">
                <div className="space-y-8">
                  <p className="font-semibold text-foreground">Member Acknowledgment & Signature:</p>
                  <div className="border-b border-border w-48" />
                  <p>{selectedMemberData.userName}</p>
                </div>
                <div className="space-y-8 text-right flex flex-col items-end">
                  <p className="font-semibold text-foreground">Mess Manager Sign-off:</p>
                  <div className="border-b border-border w-48" />
                  <p>Authorized Admin</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          body * {
            visibility: hidden;
          }
          .report-container, .report-container * {
            visibility: visible;
          }
          .report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }
          th, td {
            border-color: #e5e7eb !important;
          }
        }
      `}</style>

      <SettlementModal
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        onSuccess={load}
        member={settlementMember}
        cycle={cycle}
        defaultMode={settlementMode}
      />
    </div>
  );
}
