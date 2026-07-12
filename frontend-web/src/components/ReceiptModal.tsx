import React, { useRef } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // % discount on this line
}

interface ReceiptData {
  billNumber: string;
  date: string;
  pharmacyName: string;
  branchName?: string;
  cashierName?: string;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: string;
  isDue?: boolean;
  amountPaid?: number;
  outstanding?: number;
}

interface ReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
}

const PAY_LABELS: Record<string, string> = {
  CASH: 'Cash', CARD: 'Card', UPI: 'UPI', CHEQUE: 'Cheque',
  MOBILE_PAYMENT: 'Mobile Payment', CREDIT: 'Credit', MIXED: 'Mixed',
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML;
    if (!printContents) return;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Receipt - ${receipt.billNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; padding: 16px; color: #000; }
            .receipt-header { text-align: center; margin-bottom: 12px; }
            .receipt-header h2 { font-size: 16px; font-weight: bold; }
            .receipt-header p { font-size: 11px; color: #444; }
            .divider { border-top: 1px dashed #aaa; margin: 8px 0; }
            .info-row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            .items-table th { text-align: left; font-size: 10px; border-bottom: 1px solid #aaa; padding-bottom: 4px; }
            .items-table td { font-size: 11px; padding: 3px 0; vertical-align: top; }
            .items-table td:last-child { text-align: right; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; margin-top: 8px; font-size: 13px; }
            .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #666; }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-[scaleIn_0.15s_ease-out]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-green-600 rounded-t-2xl">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle2 size={20} />
            <span className="font-bold text-lg">Sale Complete</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Printable receipt content */}
        <div ref={printRef} className="p-5">
          {/* Header */}
          <div className="receipt-header text-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">{receipt.pharmacyName}</h2>
            {receipt.branchName && (
              <p className="text-xs text-gray-500">{receipt.branchName}</p>
            )}
          </div>

          <div className="divider border-t border-dashed border-gray-300 my-3" />

          {/* Meta info */}
          <div className="space-y-1 text-sm">
            <div className="info-row flex justify-between">
              <span className="text-gray-500">Bill #</span>
              <span className="font-mono font-semibold text-gray-800">{receipt.billNumber || '—'}</span>
            </div>
            <div className="info-row flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="text-gray-800">{receipt.date}</span>
            </div>
            {receipt.cashierName && (
              <div className="info-row flex justify-between">
                <span className="text-gray-500">Cashier</span>
                <span className="text-gray-800">{receipt.cashierName}</span>
              </div>
            )}
            <div className="info-row flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="text-gray-800">{receipt.customerName || 'Walk-in'}</span>
            </div>
          </div>

          <div className="divider border-t border-dashed border-gray-300 my-3" />

          {/* Items table */}
          <table className="items-table w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs text-gray-500 pb-1 font-semibold">Item</th>
                <th className="text-right text-xs text-gray-500 pb-1 font-semibold">Qty</th>
                <th className="text-right text-xs text-gray-500 pb-1 font-semibold">Price</th>
                <th className="text-right text-xs text-gray-500 pb-1 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, i) => {
                const lineTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
                return (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 pr-2 text-gray-800 leading-tight">{item.name}</td>
                    <td className="py-1.5 text-right text-gray-700">{item.quantity}</td>
                    <td className="py-1.5 text-right text-gray-700">
                      Rs {item.unitPrice.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                      {(item.discount || 0) > 0 && (
                        <span className="text-xs text-green-600 block">-{item.discount}%</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-900">
                      Rs {lineTotal.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="divider border-t border-dashed border-gray-300 my-3" />

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>Rs {receipt.subtotal.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
            </div>
            {receipt.discountTotal > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>- Rs {receipt.discountTotal.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            <div className="total-row flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2">
              <span>Total</span>
              <span className="text-green-700">Rs {receipt.total.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between text-gray-600 text-xs mt-1">
              <span>Payment</span>
              <span className="font-medium">{PAY_LABELS[receipt.paymentMethod] || receipt.paymentMethod}</span>
            </div>
            {receipt.isDue && receipt.outstanding != null && (
              <>
                <div className="flex justify-between text-gray-600 text-xs">
                  <span>Paid Now</span>
                  <span>Rs {(receipt.amountPaid || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between text-red-600 font-semibold text-sm">
                  <span>Outstanding</span>
                  <span>Rs {receipt.outstanding.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</span>
                </div>
              </>
            )}
          </div>

          <div className="divider border-t border-dashed border-gray-300 my-3" />

          <div className="footer text-center text-xs text-gray-400">
            Thank you for your purchase!
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-700 font-semibold text-sm transition"
          >
            <Printer size={16} /> Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 font-semibold text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
