'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface WebhookEvent {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  description: string;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  'customer.created',
  'transaction.created',
  'transaction.flagged',
  'transaction.ttr_required',
  'screening.match',
  'risk.high',
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [eventHistory, setEventHistory] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [newWebhookDescription, setNewWebhookDescription] = useState('');
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [deletingWebhook, setDeletingWebhook] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      const response = await fetch('/api/proxy/webhooks?limit=50');
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      setWebhooks(data.data || []);
    } catch {
      setError('Failed to load webhooks. Please try again.');
      setWebhooks([]);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/proxy/webhooks/events?limit=20');
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      setEventHistory(data.data || []);
    } catch {
      // Events are secondary, don't show error
      setEventHistory([]);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchWebhooks(), fetchEvents()]);
    setLoading(false);
  }, [fetchWebhooks, fetchEvents]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAddWebhook = async () => {
    if (!newWebhookUrl || newWebhookEvents.length === 0) return;

    setAddingWebhook(true);
    try {
      const response = await fetch('/api/proxy/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newWebhookUrl,
          events: newWebhookEvents,
          description: newWebhookDescription || undefined,
        }),
      });

      if (response.ok) {
        setShowAddForm(false);
        setNewWebhookUrl('');
        setNewWebhookEvents([]);
        setNewWebhookDescription('');
        await fetchWebhooks();
        alert('Webhook created successfully!');
      } else {
        const data = await response.json();
        alert(`Failed to create webhook: ${data.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert('Failed to create webhook. Please try again.');
    } finally {
      setAddingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    setDeletingWebhook(webhookId);
    try {
      // Extract the actual ID from the prefixed format
      const actualId = webhookId.startsWith('whk_') ? webhookId : `whk_${webhookId}`;
      const response = await fetch(`/api/proxy/webhooks/${actualId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchWebhooks();
        alert('Webhook deleted successfully!');
      } else {
        alert('Failed to delete webhook. Please try again.');
      }
    } catch {
      alert('Failed to delete webhook. Please try again.');
    } finally {
      setDeletingWebhook(null);
    }
  };

  const toggleEvent = (event: string) => {
    setNewWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; icon: typeof CheckCircle }> = {
      delivered: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      success: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { class: 'bg-red-100 text-red-800', icon: XCircle },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webhooks</h1>
          <p className="mt-2 text-gray-600">Configure webhook endpoints for real-time events</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Webhook
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {/* Add Webhook Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Webhook</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL * (must be HTTPS)
                </label>
                <input
                  type="url"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://your-domain.com/webhook"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newWebhookDescription}
                  onChange={(e) => setNewWebhookDescription(e.target.value)}
                  placeholder="e.g., Production notifications"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Events to Subscribe *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={newWebhookEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="mr-3 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-900">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWebhook}
                  disabled={!newWebhookUrl || newWebhookEvents.length === 0 || addingWebhook}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingWebhook && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  {addingWebhook ? 'Adding...' : 'Add Webhook'}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configured Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          )}

          {!loading && webhooks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No webhooks configured. Add one to get started.</p>
            </div>
          )}

          {!loading && webhooks.length > 0 && (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h4 className="text-base font-semibold text-gray-900 break-all">
                          {webhook.url}
                        </h4>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            webhook.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {webhook.status}
                        </span>
                      </div>

                      {webhook.description && (
                        <p className="text-sm text-gray-600 mb-3">{webhook.description}</p>
                      )}

                      <div className="flex flex-wrap gap-2 mb-4">
                        {webhook.events?.map((event) => (
                          <span
                            key={event}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {event}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(webhook.createdAt).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">Last Updated:</span>{' '}
                          {new Date(webhook.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      disabled={deletingWebhook === webhook.id}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingWebhook === webhook.id ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          )}

          {!loading && eventHistory.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No events recorded yet.</p>
            </div>
          )}

          {!loading && eventHistory.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Event Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {eventHistory.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {event.type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {event.entityType}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {event.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
