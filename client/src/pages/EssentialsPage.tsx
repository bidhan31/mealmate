import { useCallback, useEffect, useState } from 'react';
import {
  Wifi,
  Phone,
  Plus,
  Search,
  Copy,
  Check,
  Eye,
  EyeOff,
  QrCode,
  Pin,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldCheck,
  Building,
  Wrench,
  Zap,
  Flame,
  Globe,
  Sparkles,
  HeartPulse,
  Pill,
  UserCheck,
  X,
  StickyNote,
  FileText,
} from 'lucide-react';
import { essentialsApi } from '@/api/essentialsApi';
import type { EssentialDto, EssentialCategory, EssentialRoleTag } from '@/types/essentials';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { toast } from 'sonner';

export default function EssentialsPage() {
  const [items, setItems] = useState<EssentialDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'wifi' | 'contact' | 'note'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModalItem, setQrModalItem] = useState<EssentialDto | null>(null);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EssentialDto | null>(null);
  const [formCategory, setFormCategory] = useState<EssentialCategory>('wifi');
  const [formTitle, setFormTitle] = useState('');
  const [formSsid, setFormSsid] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEncryption, setFormEncryption] = useState('WPA');
  const [formRoleTag, setFormRoleTag] = useState<EssentialRoleTag>('Landlord');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAltPhone, setFormAltPhone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await essentialsApi.list();
      setItems(res.data.data.items);
    } catch {
      toast.error('Failed to load home essentials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTogglePin = async (item: EssentialDto) => {
    try {
      const updatedPin = !item.isPinned;
      await essentialsApi.update(item._id, { isPinned: updatedPin });
      setItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, isPinned: updatedPin } : i)),
      );
      toast.success(updatedPin ? 'Item pinned to top' : 'Item unpinned');
    } catch {
      toast.error('Failed to update pin status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this essential item?')) return;
    try {
      await essentialsApi.delete(id);
      setItems((prev) => prev.filter((i) => i._id !== id));
      toast.success('Item deleted');
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const openCreateModal = (cat: EssentialCategory = 'wifi') => {
    setEditingItem(null);
    setFormCategory(cat);
    setFormTitle('');
    setFormSsid('');
    setFormPassword('');
    setFormEncryption('WPA');
    setFormRoleTag('Landlord');
    setFormContactPerson('');
    setFormPhone('');
    setFormAltPhone('');
    setFormWhatsapp('');
    setFormNotes('');
    setFormIsPinned(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: EssentialDto) => {
    setEditingItem(item);
    setFormCategory(item.category);
    setFormTitle(item.title);
    setFormSsid(item.ssid || '');
    setFormPassword(item.password || '');
    setFormEncryption(item.encryption || 'WPA');
    setFormRoleTag(item.roleTag || 'Landlord');
    setFormContactPerson(item.contactPerson || '');
    setFormPhone(item.phone || '');
    setFormAltPhone(item.altPhone || '');
    setFormWhatsapp(item.whatsapp || '');
    setFormNotes(item.notes || '');
    setFormIsPinned(!!item.isPinned);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (formCategory === 'wifi' && !formPassword.trim()) {
      toast.error('Please enter Wi-Fi password');
      return;
    }
    if (formCategory === 'contact' && !formPhone.trim()) {
      toast.error('Please enter contact phone number');
      return;
    }
    if (formCategory === 'note' && !formNotes.trim()) {
      toast.error('Please enter text content for the note');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        category: formCategory,
        title: formTitle.trim(),
        ssid: formCategory === 'wifi' ? formSsid.trim() || formTitle.trim() : undefined,
        password: formCategory === 'wifi' ? formPassword.trim() : undefined,
        encryption: formCategory === 'wifi' ? formEncryption : undefined,
        roleTag: formCategory === 'contact' ? formRoleTag : undefined,
        contactPerson: formCategory === 'contact' ? formContactPerson.trim() : undefined,
        phone: formCategory === 'contact' ? formPhone.trim() : undefined,
        altPhone: formCategory === 'contact' ? formAltPhone.trim() : undefined,
        whatsapp: formCategory === 'contact' ? formWhatsapp.trim() || formPhone.trim() : undefined,
        notes: formNotes.trim() || undefined,
        isPinned: formIsPinned,
      };

      if (editingItem) {
        await essentialsApi.update(editingItem._id, payload);
        toast.success('Essential item updated!');
      } else {
        await essentialsApi.create(payload);
        toast.success('New essential item saved!');
      }
      setIsModalOpen(false);
      loadItems();
    } catch {
      toast.error('Failed to save essential item');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesRole = roleFilter === 'all' || (item.category === 'contact' && item.roleTag === roleFilter);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.ssid && item.ssid.toLowerCase().includes(q)) ||
      (item.contactPerson && item.contactPerson.toLowerCase().includes(q)) ||
      (item.phone && item.phone.includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.roleTag && item.roleTag.toLowerCase().includes(q));
    return matchesCat && matchesRole && matchesSearch;
  });

  const wifiItems = items.filter((i) => i.category === 'wifi');
  const contactItems = items.filter((i) => i.category === 'contact');
  const noteItems = items.filter((i) => i.category === 'note');
  const pinnedItems = items.filter((i) => i.isPinned);

  const getRoleIcon = (roleTag?: EssentialRoleTag) => {
    switch (roleTag) {
      case 'Landlord': return <Building className="w-4 h-4 text-amber-500" />;
      case 'Plumber': return <Wrench className="w-4 h-4 text-blue-500" />;
      case 'Electrician': return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'Gas Supplier': return <Flame className="w-4 h-4 text-orange-500" />;
      case 'ISP / Internet': return <Globe className="w-4 h-4 text-indigo-500" />;
      case 'House Maid / Cook': return <Sparkles className="w-4 h-4 text-emerald-500" />;
      case 'Hospital': return <HeartPulse className="w-4 h-4 text-red-500" />;
      case 'Pharmacy': return <Pill className="w-4 h-4 text-rose-500" />;
      default: return <UserCheck className="w-4 h-4 text-slate-500" />;
    }
  };

  const getRoleBadgeStyle = (roleTag?: EssentialRoleTag) => {
    switch (roleTag) {
      case 'Landlord': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case 'Plumber': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'Electrician': return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800';
      case 'Gas Supplier': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
      case 'ISP / Internet': return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
      case 'House Maid / Cook': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'Hospital': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
      case 'Pharmacy': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Home Essentials Hub
          </h2>
          <p className="text-muted-foreground text-sm">
            Quick-access directory for Wi-Fi credentials, emergency contacts &amp; text notes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => openCreateModal('wifi')}>
            <Wifi className="w-4 h-4 mr-1.5 text-indigo-500" />
            Add Wi-Fi
          </Button>
          <Button size="sm" variant="outline" onClick={() => openCreateModal('contact')}>
            <Phone className="w-4 h-4 mr-1.5 text-emerald-500" />
            Add Contact
          </Button>
          <Button size="sm" variant="default" onClick={() => openCreateModal('note')}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Text Note
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-500/5 to-transparent">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wi-Fi Networks</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{wifiItems.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Saved Wi-Fi &amp; credentials</p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Wifi className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service Contacts</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{contactItems.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Electrician, Plumber, Landlord</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Phone className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Text Notes</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{noteItems.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">House guidelines &amp; notices</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
              <StickyNote className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pinned Items</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{pinnedItems.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Starred for quick access</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
              <Pin className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
        {/* Category Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl w-fit flex-wrap">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              categoryFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Items ({items.length})
          </button>
          <button
            onClick={() => setCategoryFilter('wifi')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              categoryFilter === 'wifi' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            Wi-Fi ({wifiItems.length})
          </button>
          <button
            onClick={() => setCategoryFilter('contact')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              categoryFilter === 'contact' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            Contacts ({contactItems.length})
          </button>
          <button
            onClick={() => setCategoryFilter('note')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              categoryFilter === 'note' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            House Notes ({noteItems.length})
          </button>
        </div>

        {/* Search & Role Filter */}
        <div className="flex items-center gap-3">
          {categoryFilter === 'contact' && (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs rounded-xl border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Service Roles</option>
              <option value="Landlord">Landlord 🏠</option>
              <option value="Electrician">Electrician ⚡</option>
              <option value="Plumber">Plumber 🔧</option>
              <option value="Gas Supplier">Gas Supplier 🪵</option>
              <option value="ISP / Internet">ISP / Internet 🌐</option>
              <option value="House Maid / Cook">House Maid / Cook 🧹</option>
              <option value="Hospital">Hospital 🏥</option>
              <option value="Pharmacy">Pharmacy 💊</option>
              <option value="Other">Other Services</option>
            </select>
          )}

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search Wi-Fi, contacts, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>
        </div>
      </div>

      {/* Main Items Display Grid */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Loading home essentials...</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-lg font-semibold">No essentials found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {search ? 'No items match your search criteria' : 'Save your Wi-Fi password, service contacts, or house notes.'}
          </p>
          {!search && (
            <Button size="sm" onClick={() => openCreateModal('note')} className="mt-2">
              <Plus className="w-4 h-4 mr-2" />
              Add Household Note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <Card
              key={item._id}
              className={`relative overflow-hidden transition-all duration-200 hover:shadow-md border ${
                item.isPinned ? 'ring-2 ring-primary/20 border-primary/40 bg-gradient-to-b from-primary/[0.02] to-card' : ''
              }`}
            >
              {item.isPinned && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-bl-lg flex items-center gap-1">
                  <Pin className="w-3 h-3 fill-current" />
                  PINNED
                </div>
              )}

              <CardContent className="p-5 space-y-4">
                {/* Item Top Header */}
                <div className="flex items-start justify-between gap-3 pr-12">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        item.category === 'wifi'
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : item.category === 'note'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {item.category === 'wifi' ? (
                        <Wifi className="w-5 h-5" />
                      ) : item.category === 'note' ? (
                        <StickyNote className="w-5 h-5" />
                      ) : (
                        getRoleIcon(item.roleTag)
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground leading-tight">{item.title}</h3>
                      {item.category === 'wifi' ? (
                        <p className="text-xs text-muted-foreground mt-0.5">SSID: <strong className="text-foreground">{item.ssid || item.title}</strong></p>
                      ) : item.category === 'note' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border mt-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                          <FileText className="w-3 h-3" /> Household Note
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border mt-1 ${getRoleBadgeStyle(item.roleTag)}`}>
                          {getRoleIcon(item.roleTag)}
                          {item.roleTag}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* MODULE A: WI-FI & CREDENTIALS CONTENT */}
                {item.category === 'wifi' && (
                  <div className="space-y-3 pt-1 border-t border-border/60">
                    <div className="bg-muted/50 p-3 rounded-xl space-y-2 border border-border/40">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Wi-Fi Password:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => togglePasswordVisibility(item._id)}
                            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                          >
                            {visiblePasswords[item._id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(item.password || '', item._id, 'Password')}
                            className="p-1 text-muted-foreground hover:text-primary rounded transition-colors"
                          >
                            {copiedId === item._id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <p className="font-mono text-sm font-bold tracking-wider text-foreground break-all">
                        {visiblePasswords[item._id] ? item.password : '••••••••••••'}
                      </p>
                    </div>

                    {item.notes && <p className="text-xs text-muted-foreground italic">Note: {item.notes}</p>}

                    <Button variant="outline" size="sm" onClick={() => setQrModalItem(item)} className="w-full text-xs gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-indigo-500" /> Show Join QR Code
                    </Button>
                  </div>
                )}

                {/* MODULE B: SERVICE CONTACT CONTENT */}
                {item.category === 'contact' && (
                  <div className="space-y-3 pt-1 border-t border-border/60">
                    {item.contactPerson && (
                      <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                        {item.contactPerson}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${item.phone}`}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </a>
                      {item.whatsapp && (
                        <a
                          href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-bold border border-green-500/20 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </div>

                    {item.notes && <p className="text-xs text-muted-foreground italic">Note: {item.notes}</p>}
                  </div>
                )}

                {/* MODULE C: TEXT NOTE CONTENT */}
                {item.category === 'note' && (
                  <div className="space-y-3 pt-1 border-t border-border/60">
                    <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/15 space-y-2">
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                        {item.notes || 'No note content provided.'}
                      </p>
                    </div>

                    {item.notes && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(item.notes || '', item._id, 'Note text')}
                        className="w-full text-xs gap-1.5"
                      >
                        {copiedId === item._id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied to Clipboard
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-amber-500" /> Copy Note Text
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <button
                    onClick={() => handleTogglePin(item)}
                    className={`flex items-center gap-1 transition-colors ${
                      item.isPinned ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {item.isPinned ? 'Unpin' : 'Pin'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditModal(item)} className="p-1.5 text-muted-foreground hover:text-foreground rounded">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item._id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Modal for Wi-Fi */}
      {qrModalItem && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-foreground flex items-center justify-center gap-2">
              <Wifi className="w-5 h-5 text-indigo-500" />
              {qrModalItem.title}
            </h3>
            <p className="text-xs text-muted-foreground">Scan with phone camera to connect directly to Wi-Fi</p>
            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  `WIFI:S:${qrModalItem.ssid || qrModalItem.title};T:${qrModalItem.encryption || 'WPA'};P:${qrModalItem.password};;`,
                )}`}
                alt="Wi-Fi QR Code"
                className="w-44 h-44 mx-auto"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setQrModalItem(null)} className="w-full">
              Close QR Code
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Essential Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                {formCategory === 'wifi' ? (
                  <Wifi className="w-5 h-5 text-indigo-500" />
                ) : formCategory === 'note' ? (
                  <StickyNote className="w-5 h-5 text-amber-500" />
                ) : (
                  <Phone className="w-5 h-5 text-emerald-500" />
                )}
                {editingItem ? 'Edit Essential Item' : 'Add Essential Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              {/* Category Selector */}
              {!editingItem && (
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormCategory('wifi')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      formCategory === 'wifi' ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    Wi-Fi
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCategory('contact')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      formCategory === 'contact' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCategory('note')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      formCategory === 'note' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                    Note
                  </button>
                </div>
              )}

              {/* Title Input */}
              <Input
                label={
                  formCategory === 'wifi'
                    ? 'Wi-Fi Network Name / Label'
                    : formCategory === 'note'
                    ? 'Note Title / Subject'
                    : 'Contact Title / Service Name'
                }
                placeholder={
                  formCategory === 'wifi'
                    ? 'e.g. Home Main 5G'
                    : formCategory === 'note'
                    ? 'e.g. House Rules & Guidelines'
                    : 'e.g. House Electrician'
                }
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />

              {/* MODULE A: WI-FI SPECIFIC FIELDS */}
              {formCategory === 'wifi' && (
                <>
                  <Input
                    label="SSID (Broadcast Name)"
                    placeholder="e.g. Mess_Home_5G"
                    value={formSsid}
                    onChange={(e) => setFormSsid(e.target.value)}
                  />
                  <Input
                    label="Wi-Fi Password"
                    placeholder="WPA Password key"
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                  />
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Security Type</label>
                    <select
                      value={formEncryption}
                      onChange={(e) => setFormEncryption(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="WPA">WPA / WPA2 / WPA3 (Standard)</option>
                      <option value="WEP">WEP (Legacy)</option>
                      <option value="nopass">Open (No Password)</option>
                    </select>
                  </div>
                </>
              )}

              {/* MODULE B: SERVICE CONTACT SPECIFIC FIELDS */}
              {formCategory === 'contact' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Service Role Tag</label>
                    <select
                      value={formRoleTag}
                      onChange={(e) => setFormRoleTag(e.target.value as EssentialRoleTag)}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Landlord">Landlord 🏠</option>
                      <option value="Electrician">Electrician ⚡</option>
                      <option value="Plumber">Plumber 🔧</option>
                      <option value="Gas Supplier">Gas Supplier 🪵</option>
                      <option value="ISP / Internet">ISP / Internet 🌐</option>
                      <option value="House Maid / Cook">House Maid / Cook 🧹</option>
                      <option value="Hospital">Hospital 🏥</option>
                      <option value="Pharmacy">Pharmacy 💊</option>
                      <option value="Other">Other Services</option>
                    </select>
                  </div>

                  <Input
                    label="Contact Person Name"
                    placeholder="e.g. Md. Rahim"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                  />

                  <Input
                    label="Phone Number"
                    placeholder="e.g. 01712345678"
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    required
                  />

                  <Input
                    label="WhatsApp Number (Optional)"
                    placeholder="Leave blank to use Phone"
                    type="tel"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                  />
                </>
              )}

              {/* MODULE C: TEXT NOTE SPECIFIC FIELDS */}
              {formCategory === 'note' ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Detailed Text Note Content
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Enter your detailed house guidelines, gate codes, garbage collection schedule, or important notes..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    required
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ) : (
                <Input
                  label="Notes / Availability (Optional)"
                  placeholder="e.g. Available 9 AM - 8 PM, Router in hallway"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={formIsPinned}
                  onChange={(e) => setFormIsPinned(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isPinned" className="text-xs font-medium text-foreground cursor-pointer">
                  Pin to top of Essentials page
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <Button type="button" variant="outline" className="w-full text-xs" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" className="w-full text-xs" disabled={submitting}>
                  {submitting ? 'Saving...' : editingItem ? 'Update Essential' : 'Save Essential'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
