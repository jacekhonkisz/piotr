'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  Edit3, 
  Save, 
  X, 
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

import { supabase } from '../lib/supabase';

interface AIExecutiveSummaryProps {
  clientId: string;
  dateRange: {
    start: string;
    end: string;
  };
  reportData: any;
  onSummaryGenerated?: (summary: string) => void;
}

interface ExecutiveSummary {
  id?: string;
  content: string;
  generated_at: string;
  is_ai_generated: boolean;
}

export default function AIExecutiveSummary({ 
  clientId, 
  dateRange, 
  reportData, 
  onSummaryGenerated 
}: AIExecutiveSummaryProps) {

  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing summary on component mount
  useEffect(() => {
    loadExistingSummary();
  }, [clientId, dateRange.start, dateRange.end]);

  const loadExistingSummary = async () => {
    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No session token available');
        return;
      }

      const response = await fetch('/api/executive-summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.summary) {
          setSummary(data.summary);
          setEditedContent(data.summary.content);
        }
      }
    } catch (error) {
      console.error('Error loading existing summary:', error);
    }
  };

  const generateAISummary = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session token available');
      }

      const response = await fetch('/api/generate-executive-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          reportData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      
      const newSummary: ExecutiveSummary = {
        content: data.summary,
        generated_at: new Date().toISOString(),
        is_ai_generated: true
      };

      setSummary(newSummary);
      setEditedContent(data.summary);
      
      // Save the generated summary
      await saveSummary(newSummary);
      
      if (onSummaryGenerated) {
        onSummaryGenerated(data.summary);
      }

    } catch (error) {
      console.error('Error generating AI summary:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveSummary = async (summaryToSave: ExecutiveSummary) => {
    setIsSaving(true);
    
    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session token available');
      }

      const response = await fetch('/api/executive-summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          summary: summaryToSave
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save summary');
      }

      const data = await response.json();
      if (data.summary?.id) {
        setSummary(prev => prev ? { ...prev, id: data.summary.id } : null);
      }

    } catch (error) {
      console.error('Error saving summary:', error);
      setError('Failed to save summary');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!summary) return;

    const updatedSummary: ExecutiveSummary = {
      ...summary,
      content: editedContent,
      is_ai_generated: false // Mark as manually edited
    };

    await saveSummary(updatedSummary);
    setSummary(updatedSummary);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(summary?.content || '');
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!summary && !isGenerating) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Podsumowanie wykonawcze
            </h3>
          </div>
        </div>
        
        <div className="text-center py-8">
          <div className="mb-4">
            <Sparkles className="h-12 w-12 text-blue-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Brak podsumowania
            </h4>
            <p className="text-gray-600 mb-6">
              Wygeneruj inteligentne podsumowanie wyników kampanii Meta Ads za pomocą AI
            </p>
          </div>
          
          <button
            onClick={generateAISummary}
            disabled={isGenerating}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generowanie...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Wygeneruj podsumowanie AI
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Podsumowanie wykonawcze
          </h3>
          {summary?.is_ai_generated && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {summary && !isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Edytuj
              </button>
              <button
                onClick={generateAISummary}
                disabled={isGenerating}
                className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Generowanie podsumowania AI...</p>
          </div>
        </div>
      )}

      {summary && !isGenerating && (
        <>
          {isEditing ? (
            <div className="space-y-4">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-48 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Edytuj podsumowanie..."
              />
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <X className="h-4 w-4 mr-1" />
                  Anuluj
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Zapisz
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-700 leading-relaxed text-left" style={{ textIndent: '0', paddingLeft: '0', marginLeft: '0' }}>
              <div className="whitespace-normal" style={{ textIndent: '0', paddingLeft: '0', marginLeft: '0' }}>
                {summary.content.trim()}
              </div>
            </div>
          )}

          {summary.generated_at && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Wygenerowano: {formatDate(summary.generated_at)}
                </span>
                {summary.is_ai_generated && (
                  <span className="flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    AI Generated
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 