"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateCashflowSuggestions, addCashflowAdjustment } from "@/lib/agents/cashflow/actions";
import { Sparkles, Plus, Check } from "lucide-react";

export function CashflowSheet() {
    const [open, setOpen] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    // Manual Entry Form
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState("");
    const [type, setType] = useState<"IN" | "OUT">("OUT");

    const handleGenerate = async () => {
        setLoadingSuggestions(true);
        try {
            const res = await generateCashflowSuggestions();
            setSuggestions(res);
        } catch (e) {
            toast.error("Failed to generate suggestions");
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleAdd = async (suggestion?: any) => {
        try {
            const data = suggestion ? {
                description: suggestion.description,
                amount: Number(suggestion.amount),
                date: new Date(suggestion.date),
                type: suggestion.type
            } : {
                description: desc,
                amount: Number(amount),
                date: new Date(date),
                type: type
            };

            await addCashflowAdjustment(data);
            toast.success("Adjustment added");
            if (!suggestion) {
                setDesc("");
                setAmount("");
                setDate("");
            } else {
                setSuggestions(prev => prev.filter(s => s !== suggestion));
            }
        } catch (e) {
            toast.error("Failed to add adjustment");
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline">Manage Adjustments</Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>Cashflow Adjustments</SheetTitle>
                    <SheetDescription>Add manual items or use AI to predict recurring transactions.</SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="ai" className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="ai">AI Suggestions</TabsTrigger>
                        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                    </TabsList>

                    <TabsContent value="ai" className="space-y-4">
                        <div className="flex justify-end">
                            <Button onClick={handleGenerate} disabled={loadingSuggestions} size="sm">
                                <Sparkles className="w-4 h-4 mr-2" />
                                {loadingSuggestions ? "Analyzing..." : "Generate Predictions"}
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {suggestions.map((s, i) => (
                                <div key={i} className="flex justify-between items-center p-3 border rounded-lg bg-muted/30">
                                    <div>
                                        <p className="font-medium">{s.description}</p>
                                        <p className="text-xs text-muted-foreground">Predicted: {s.date}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold ${s.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                            ${s.amount}
                                        </span>
                                        <Button size="icon" variant="ghost" onClick={() => handleAdd(s)}>
                                            <Check className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {suggestions.length === 0 && !loadingSuggestions && (
                                <div className="text-center text-muted-foreground py-8">No suggestions yet. Click generate.</div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="manual" className="space-y-4">
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Tax Payment" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={type} onValueChange={(v: any) => setType(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IN">Cash In</SelectItem>
                                        <SelectItem value="OUT">Cash Out</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                        <Button onClick={() => handleAdd()} className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Adjustment
                        </Button>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
