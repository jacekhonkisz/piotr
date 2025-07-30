'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Link, 
  Save, 
  X,
  Eye,
  EyeOff,
  History,
  Tag
} from 'lucide-react';

interface NotesEditorProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  initialContent?: string;
  onSave: (content: string, noteType: string, tags: string[]) => Promise<void>;
}

interface NoteHistory {
  id: string;
  content: string;
  noteType: string;
  tags: string[];
  createdAt: string;
  adminName: string;
}

export default function NotesEditor({
  isOpen,
  onClose,
  clientId,
  clientName,
  initialContent = '',
  onSave
}: NotesEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [noteType, setNoteType] = useState<'internal' | 'client'>('internal');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [noteHistory, setNoteHistory] = useState<NoteHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNoteHistory();
    }
  }, [isOpen, clientId]);

  const loadNoteHistory = async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) return;

      const response = await fetch(`/api/clients/${clientId}/notes`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const history = await response.json();
        setNoteHistory(history);
      }
    } catch (error) {
      console.error('Error loading note history:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content, noteType, tags);
      onClose();
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const insertMarkdown = (markdown: string) => {
    const textarea = document.getElementById('notes-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      
      let newText = '';
      if (markdown === '**' || markdown === '*' || markdown === '`') {
        newText = content.substring(0, start) + markdown + selectedText + markdown + content.substring(end);
      } else if (markdown === '- ' || markdown === '1. ') {
        newText = content.substring(0, start) + markdown + content.substring(end);
      } else if (markdown === '> ') {
        newText = content.substring(0, start) + markdown + content.substring(end);
      } else if (markdown === '[link](url)') {
        newText = content.substring(0, start) + markdown + content.substring(end);
      }
      
      setContent(newText);
      
      // Set cursor position after the inserted markdown
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + markdown.length, start + markdown.length + selectedText.length);
      }, 0);
    }
  };

  const renderMarkdownPreview = (text: string) => {
    // Simple markdown rendering
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic">$1</blockquote>')
      .replace(/^- (.*$)/gm, '<li class="list-disc ml-4">$1</li>')
      .replace(/^1\. (.*$)/gm, '<li class="list-decimal ml-4">$1</li>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank">$1</a>')
      .replace(/\n/g, '<br>');

    return { __html: html };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-full max-h-[90vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Notes</h2>
            <p className="text-sm text-gray-500">{clientName}</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title="View History"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              title={showPreview ? 'Hide Preview' : 'Show Preview'}
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Editor */}
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => insertMarkdown('**')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertMarkdown('*')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertMarkdown('`')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Code"
                >
                  <Code className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertMarkdown('> ')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Quote"
                >
                  <Quote className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertMarkdown('- ')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Unordered List"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertMarkdown('1. ')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Ordered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertMarkdown('[link](url)')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Link"
                >
                  <Link className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as 'internal' | 'client')}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="internal">Internal Note</option>
                  <option value="client">Client Note</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Tags:</span>
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add tag..."
                  className="text-sm border border-gray-300 rounded px-2 py-1 w-24"
                />
                <button
                  onClick={addTag}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Editor/Preview */}
            <div className="flex-1 flex">
              {showPreview ? (
                <div className="flex-1 p-4 overflow-auto">
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={renderMarkdownPreview(content)}
                  />
                </div>
              ) : (
                <textarea
                  id="notes-textarea"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 p-4 border-none resize-none focus:outline-none"
                  placeholder="Write your notes here... Use markdown for formatting."
                />
              )}
            </div>
          </div>

          {/* History Sidebar */}
          {showHistory && (
            <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Note History</h3>
                {noteHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">No previous notes found.</p>
                ) : (
                  <div className="space-y-3">
                    {noteHistory.map((note) => (
                      <div key={note.id} className="bg-white p-3 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">
                            {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            note.noteType === 'internal' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {note.noteType}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {note.content.substring(0, 150)}...
                        </p>
                        {note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {note.tags.map(tag => (
                              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          By: {note.adminName}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 