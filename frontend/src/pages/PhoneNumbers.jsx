import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, CheckCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@/components/ui/table';

const initialForm = {
  label: '',
  phoneNumber: '',
  twilioConfig: {
    accountSid: '',
    authToken: '',
    phoneNumber: ''
  },
  isPrimary: false
};

export default function PhoneNumbers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const { token } = useAuth();

  const headers = { Authorization: `Bearer ${token}` };

  const fetchItems = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/phone-numbers', { headers });
      setItems(res.data);
    } catch (err) {
      console.error('Fetch phone numbers error:', err);
      toast.error('Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('twilio.')) {
      const key = name.split('.')[1];
      setForm((prev) => ({ ...prev, twilioConfig: { ...prev.twilioConfig, [key]: value } }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation
    if (!/^\+[1-9]\d{1,14}$/.test(form.phoneNumber)) {
      toast.error('Main phone number must be E.164 (e.g., +18314809309)');
      return;
    }
    if (!/^\+[1-9]\d{1,14}$/.test(form.twilioConfig.phoneNumber)) {
      toast.error('Twilio phone number must be E.164');
      return;
    }
    if (!form.twilioConfig.accountSid || !form.twilioConfig.authToken) {
      toast.error('Twilio Account SID and Auth Token are required');
      return;
    }

    try {
      // Validate Twilio credentials before creating
      const validateRes = await axios.post('http://localhost:3000/api/twilio/validate', {
        accountSid: form.twilioConfig.accountSid,
        authToken: form.twilioConfig.authToken,
        phoneNumber: form.twilioConfig.phoneNumber,
      }, { headers });

      if (!validateRes.data?.valid) {
        toast.error(validateRes.data?.error || 'Invalid Twilio credentials');
        return;
      }

      const res = await axios.post('http://localhost:3000/api/phone-numbers', form, { headers });
      setItems((prev) => [res.data, ...prev]);
      setOpen(false);
      setForm(initialForm);
      toast.success('Phone number added');
    } catch (err) {
      console.error('Create phone number error:', err);
      toast.error(err.response?.data?.message || 'Failed to add number');
    }
  };

  const makePrimary = async (id) => {
    try {
      const res = await axios.post(`http://localhost:3000/api/phone-numbers/${id}/make-primary`, {}, { headers });
      setItems((prev) => prev.map((i) => ({ ...i, is_primary: i.id === id })));
      toast.success('Primary number updated');
    } catch (err) {
      console.error('Set primary error:', err);
      toast.error('Failed to set primary');
    }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`http://localhost:3000/api/phone-numbers/${id}`, { headers });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Phone number removed');
    } catch (err) {
      console.error('Delete phone number error:', err);
      toast.error('Failed to remove number');
    }
  };

  return (
    <div >
      <div className="flex items-center justify-between mt-10 mb-10">
        <h1 className="text-2xl font-bold">Phone Numbers</h1>
        <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Number
        </Button>
      </div>

      <Card className="rounded-2xl overflow-hidden ">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <TableHead className="px-4 py-3">Label</TableHead>
              <TableHead className="px-4 py-3">Main Number</TableHead>
              <TableHead className="px-4 py-3">Twilio Number</TableHead>
              <TableHead className="px-4 py-3">Primary</TableHead>
              <TableHead className="px-4 py-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell className="px-4 py-6" colSpan={5}>Loading...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell className="px-4 py-6" colSpan={5}>No phone numbers yet</TableCell></TableRow>
            ) : (
              items.map((i) => (
                <TableRow key={i.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <TableCell className="px-4 py-3">{i.label || '-'}</TableCell>
                  <TableCell className="px-4 py-3">{i.phone_number}</TableCell>
                  <TableCell className="px-4 py-3">{i.twilio_config?.phoneNumber || '-'}</TableCell>
                  <TableCell className="px-4 py-3">
                    {i.is_primary ? (
                      <span className="inline-flex items-center gap-1 text-primary"><CheckCircle className="w-4 h-4"/> Primary</span>
                    ) : (
                      <Button variant="link" className="text-sm" onClick={() => makePrimary(i.id)}>Make Primary</Button>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button variant="destructive" onClick={() => remove(i.id)} className="inline-flex items-center gap-1">
                      <Trash2 className="w-4 h-4" /> Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {open && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-xl p-6 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Phone Number</h2>
              <button className="text-gray-500" onClick={() => setOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Label</label>
                <Input name="label" value={form.label} onChange={handleChange} placeholder="e.g., Sales Line" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Main Phone Number (E.164)</label>
                <Input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} placeholder="+18314809309" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Twilio Account SID</label>
                  <Input name="twilio.accountSid" value={form.twilioConfig.accountSid} onChange={handleChange} placeholder="ACxxxxxxxx" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Twilio Auth Token</label>
                  <Input name="twilio.authToken" value={form.twilioConfig.authToken} onChange={handleChange} placeholder="••••••••" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Twilio Phone Number (E.164)</label>
                <Input name="twilio.phoneNumber" value={form.twilioConfig.phoneNumber} onChange={handleChange} placeholder="+18314809309" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPrimary" checked={form.isPrimary} onChange={(e) => setForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} />
                <label htmlFor="isPrimary" className="text-sm">Set as primary number</label>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}