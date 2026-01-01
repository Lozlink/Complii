'use client';

import { useState } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function WebhooksPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);

  // Mock webhook configurations
  const webhooks = [
    {
      id: 'wh_1',
      url: 'https://api.example.com/webhooks/complii',
      events: ['customer.created', 'customer.verified', 'transaction.flagged'],
      status: 'active',
      createdAt: '2025-12-01T10:00:00Z',
      lastDelivery: '2025-12-23T15:30:00Z',
      successRate: 98.5,
    },
    {
      id: 'wh_2',
      url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX',
      events: ['sanctions.match', 'pep.identified'],
      status: 'active',
      createdAt: '2025-11-15T14:00:00Z',
      lastDelivery: '2025-12-22T11:20:00Z',
      successRate: 100,
    },
  ];

  // Mock event history
  const eventHistory = [
    {
      id: 'evt_1',
      webhookId: 'wh_1',
      event: 'customer.verified',
      status: 'success',
      attempts: 1,
      timestamp: '2025-12-23T15:30:00Z',
    },
    {
      id: 'evt_2',
      webhookId: 'wh_2',
      event: 'sanctions.match',
      status: 'success',
      attempts: 1,
      timestamp: '2025-12-22T11:20:00Z',
    },
    {
      id: 'evt_3',
      webhookId: 'wh_1',
      event: 'transaction.flagged',
      status: 'failed',
      attempts: 3,
      timestamp: '2025-12-21T09:45:00Z',
      error: 'Timeout after 30 seconds',
    },
  ];

  const availableEvents = [
    'customer.created',
    'customer.updated',
    'customer.verified',
    'customer.deleted',
    'transaction.created',
    'transaction.flagged',
    'sanctions.match',
    'pep.identified',
    'kyc.approved',
    'kyc.rejected',
  ];

  const handleAddWebhook = () => {
    console.log('Adding webhook:', { url: newWebhookUrl, events: newWebhookEvents });
    setShowAddForm(false);
    setNewWebhookUrl('');
    setNewWebhookEvents([]);
  };

  const toggleEvent = (event: string) => {
    setNewWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      success: { class: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { class: 'bg-red-100 text-red-800', icon: XCircle },
      pending: { class: 'bg-yellow-100 text-yellow-800', icon: Clock },
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webhooks</h1>
          <p className="mt-2 text-gray-600">Configure webhook endpoints for real-time events</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Webhook
        </button>
      </div>

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
                  Webhook URL *
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
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Events to Subscribe
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableEvents.map((event) => (
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
                  disabled={!newWebhookUrl || newWebhookEvents.length === 0}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Webhook
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

                    <div className="flex flex-wrap gap-2 mb-4">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {event}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Created:</span>{' '}
                        {new Date(webhook.createdAt).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Last Delivery:</span>{' '}
                        {webhook.lastDelivery
                          ? new Date(webhook.lastDelivery).toLocaleDateString()
                          : 'Never'}
                      </div>
                      <div>
                        <span className="font-medium">Success Rate:</span>{' '}
                        <span
                          className={`font-semibold ${
                            webhook.successRate >= 95 ? 'text-green-600' : 'text-orange-600'
                          }`}
                        >
                          {webhook.successRate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <button className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Event History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Webhook
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Attempts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {eventHistory.map((event) => {
                  const webhook = webhooks.find((w) => w.id === event.webhookId);
                  const badge = getStatusBadge(event.status);
                  return (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {event.event}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {webhook?.url}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.class}`}
                        >
                          <badge.icon className="w-3 h-3 mr-1" />
                          {event.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{event.attempts}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
