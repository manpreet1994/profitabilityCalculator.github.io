import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { PricingData, PricingField } from './types';
import { CubeIcon, TagIcon, ChartBarIcon, TrashIcon, UploadIcon, PlusIcon, CurrencyDollarIcon, DownloadIcon, ArrowUpIcon, ArrowDownIcon, SwitchVerticalIcon } from './components/icons';

const createNewItem = (defaults?: Partial<PricingData>): PricingData => {
  return {
    id: `item-${Date.now()}-${Math.random()}`,
    itemName: defaults?.itemName || 'New Item',
    quantity: defaults?.quantity || '30',
    cost: defaults?.cost || '9.75',
    discount: defaults?.discount || '0.02',
    gst: defaults?.gst || '0.18',
    expense: defaults?.expense || '55',
    selling_price: defaults?.selling_price || '660',
    effective_cost: '',
    cost_with_gst: '',
    final_cost: '',
    selling_price_without_gst: '',
    selling_price_per_metre: '',
    profit: '',
  };
};

const calculateRow = (rowData: PricingData, lastChangedField: PricingField | null): PricingData => {
  const p = (v: string) => parseFloat(v) || 0;

  const quantity = p(rowData.quantity);
  const cost = p(rowData.cost);
  const discount = p(rowData.discount);
  const gst = p(rowData.gst);
  const expense = p(rowData.expense);
  let selling_price = p(rowData.selling_price);

  // Cost side calculations
  const effective_cost = (quantity * cost) * (1 - discount);
  const cost_with_gst = effective_cost * (1 + gst);
  const final_cost = cost_with_gst + expense;

  // Selling side calculations
  const selling_price_without_gst = selling_price / (1 + gst);
  const selling_price_per_metre = quantity > 0 ? selling_price_without_gst / quantity : 0;
  const profit = selling_price - final_cost;

  const format = (num: number, decimals: number = 2) => {
    if (isNaN(num) || !isFinite(num)) return '0.00';
    return num.toFixed(decimals);
  };

  return {
    ...rowData,
    effective_cost: format(effective_cost),
    cost_with_gst: format(cost_with_gst),
    final_cost: format(final_cost),
    selling_price_without_gst: format(selling_price_without_gst),
    selling_price_per_metre: format(selling_price_per_metre, 3),
    profit: format(profit),
  };
};

const TableInput: React.FC<{
  item: PricingData;
  field: PricingField;
  onChange: (id: string, name: PricingField, value: string) => void;
}> = ({ item, field, onChange }) => {
   const hasCurrencySymbol = ['cost', 'selling_price', 'profit', 'expense', 'final_cost'].includes(field);
   return (
      <div className="relative">
          {hasCurrencySymbol && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">₹</span>}
          <input
              type="text"
              value={item[field]}
              onChange={(e) => onChange(item.id, field, e.target.value)}
              className={`w-full bg-slate-700/50 border border-slate-600 rounded-md py-1.5 px-2 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors ${hasCurrencySymbol ? 'pl-6' : ''}`}
              placeholder={field === 'itemName' ? 'Enter item name' : '0.00'}
          />
      </div>
   );
}


const App: React.FC = () => {
  const [items, setItems] = useState<PricingData[]>(() => [calculateRow(createNewItem(), null)]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'none'>('none');
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const newTotalProfit = items.reduce((sum, item) => sum + (parseFloat(item.profit) || 0), 0);
    setTotalProfit(newTotalProfit);
  }, [items]);
  
  const handleInputChange = useCallback((id: string, name: PricingField, value: string) => {
    const numericFields: PricingField[] = ['quantity', 'cost', 'discount', 'gst', 'expense', 'selling_price'];
    const sanitizedValue = numericFields.includes(name) ? value.replace(/[^0-9.-]/g, '') : value;
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? calculateRow({ ...item, [name]: sanitizedValue }, name) : item
      )
    );
  }, []);

  const addItem = () => {
    // Use values from the first item as defaults for the new one
    const defaults = items.length > 0 ? {
        discount: items[0].discount,
        gst: items[0].gst,
        expense: items[0].expense,
    } : {};
    const newItem = createNewItem(defaults);
    setItems(prev => [...prev, calculateRow(newItem, null)]);
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };
  
  const handleSaveState = () => {
    if (items.length === 0) {
        alert("There is no data to save.");
        return;
    }
    const jsonString = JSON.stringify(items, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "profit-calculator-state.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadState = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const loadedItems = JSON.parse(text);
            
            if (!Array.isArray(loadedItems) || (loadedItems.length > 0 && typeof loadedItems[0].itemName === 'undefined')) {
                 throw new Error("Invalid or corrupted state file.");
            }

            setItems(loadedItems);
        } catch(error) {
            alert(`Error loading state: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsText(file);
  };
  
  const handleSortByProfit = () => {
    setSortDirection(current => {
        if (current === 'none') return 'desc';
        if (current === 'desc') return 'asc';
        return 'none';
    });
  };

  const sortedItems = useMemo(() => {
    if (sortDirection === 'none') {
        return items;
    }
    const sortableItems = [...items];
    sortableItems.sort((a, b) => {
        const profitA = parseFloat(a.profit) || 0;
        const profitB = parseFloat(b.profit) || 0;
        if (sortDirection === 'asc') {
            return profitA - profitB;
        } else {
            return profitB - profitA;
        }
    });
    return sortableItems;
  }, [items, sortDirection]);

  const headers = [
    { key: 'itemName', label: 'Item Name', icon: TagIcon },
    { key: 'quantity', label: 'Quantity', icon: CubeIcon },
    { key: 'cost', label: 'Cost/Metre', icon: CurrencyDollarIcon },
    { key: 'selling_price', label: 'Selling Price', icon: ChartBarIcon },
    { key: 'profit', label: 'Profit' },
    { key: 'selling_price_per_metre', label: 'SP/Metre' },
    { key: 'final_cost', label: 'Final Cost' },
    { key: 'discount', label: 'Discount %' },
    { key: 'gst', label: 'GST %' },
    { key: 'expense', label: 'Expense' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            Profitability Calculator
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Manage pricing and profits for multiple items in bulk.
          </p>
        </header>

        <main>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <button onClick={addItem} className="flex items-center justify-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                    <PlusIcon className="h-5 w-5"/>
                    Add Item
                </button>
                <button onClick={handleSaveState} className="flex items-center justify-center gap-2 w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                    <DownloadIcon className="h-5 w-5"/>
                    Save
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                    <UploadIcon className="h-5 w-5"/>
                    Load
                </button>
                 <input type="file" ref={fileInputRef} onChange={handleLoadState} accept=".json" className="hidden" />
            </div>
          
            <div className="overflow-x-auto bg-slate-800/50 border border-slate-700 rounded-2xl shadow-lg">
                <table className="w-full min-w-[1200px] text-sm text-left text-slate-300">
                    <thead className="text-xs text-cyan-400 uppercase bg-slate-800 sticky top-0">
                        <tr>
                            {headers.map(h => (
                                <th key={h.key} scope="col" className="px-4 py-3 whitespace-nowrap">
                                    {h.key === 'profit' ? (
                                        <button onClick={handleSortByProfit} className="flex items-center gap-2 bg-transparent text-current border-none p-0 font-inherit cursor-pointer focus:outline-none w-full text-left uppercase" aria-label={`Sort by ${h.label}`}>
                                            <div className="flex items-center gap-2">
                                                {h.icon && <h.icon className="h-4 w-4"/>}
                                                {h.label}
                                            </div>
                                            {sortDirection === 'asc' && <ArrowUpIcon className="h-4 w-4 text-cyan-400" />}
                                            {sortDirection === 'desc' && <ArrowDownIcon className="h-4 w-4 text-cyan-400" />}
                                            {sortDirection === 'none' && <SwitchVerticalIcon className="h-4 w-4 text-slate-500" />}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {h.icon && <h.icon className="h-4 w-4"/>}
                                            {h.label}
                                        </div>
                                    )}

                                </th>
                            ))}
                            <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                       {sortedItems.map((item) => (
                         <tr key={item.id} className="border-b border-slate-700 hover:bg-slate-800/60">
                            <td className="px-4 py-2 w-48"><TableInput item={item} field="itemName" onChange={handleInputChange}/></td>
                            <td className="px-4 py-2"><TableInput item={item} field="quantity" onChange={handleInputChange}/></td>
                            <td className="px-4 py-2"><TableInput item={item} field="cost" onChange={handleInputChange}/></td>
                            <td className="px-4 py-2"><TableInput item={item} field="selling_price" onChange={handleInputChange}/></td>
                            <td className="px-4 py-2 text-lg">₹{item.profit}</td>
                            <td className="px-4 py-2">₹{item.selling_price_per_metre}</td>
                            <td className="px-4 py-2">₹{item.final_cost}</td>
                            <td className="px-4 py-2"><TableInput item={item} field="discount" onChange={handleInputChange}/></td>
                            <td className="px-4 py-2"><TableInput item={item} field="gst" onChange={handleInputChange}/></td>
                            <td className="px-4 py-2"><TableInput item={item} field="expense" onChange={handleInputChange}/></td>
                            <td className="px-4 py-2 text-right">
                                <button onClick={() => deleteItem(item.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors">
                                    <TrashIcon className="h-5 w-5"/>
                                </button>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                </table>
                 {items.length === 0 && <p className="text-center py-12 text-slate-500">No items to display. Add an item or load a state file to get started.</p>}
            </div>

            <div className={`mt-8 p-6 rounded-2xl shadow-lg border transition-all duration-300 ${totalProfit > 0 ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
                <h2 className={`text-2xl font-semibold border-b pb-3 mb-3 ${totalProfit > 0 ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'}`}>
                    Total Profit
                </h2>
                <p className="text-slate-400 text-sm mb-2">Sum of profits from all items.</p>
                <div className={`text-5xl font-bold tracking-tight ${totalProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ₹{totalProfit.toFixed(2)}
                </div>
            </div>
        </main>
      </div>
    </div>
  );
};

export default App;