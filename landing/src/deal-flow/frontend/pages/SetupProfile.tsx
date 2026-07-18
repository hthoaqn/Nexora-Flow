// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { api } from '../api';
import { useStartupStore, createEmptyProfile } from '../store/useStartupStore';
import CompareChanges, { FIELD_LABELS } from '../components/CompareChanges';
import ExtractionReview from '../components/ExtractionReview';
import { TeamMemberDTO, UseOfFundsDTO, StartupProfileDTO, ProfileVersionDTO } from '../../types';
import { toast } from 'sonner';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  History,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  Sparkles,
  PlusCircle,
  Edit3,
  Check,
  AlertCircle,
} from 'lucide-react';

function normalizeConfidence(val: number): number {
  if (val > 1) return val / 100;
  return val;
}

function normalizeExtractionResponse(data: any) {
  return {
    extractionId: data.extractionId ?? data.extraction_id,
    status: data.status ?? "completed",
    mode: data.mode ?? "real",
    fields: Array.isArray(data.fields)
      ? data.fields.map((item: any) => ({
          field: item.field,
          mappedField: item.mappedField ?? item.field,
          label: item.label ?? item.field,
          value: item.value ?? null,
          confidence: normalizeConfidence(Number(item.confidence ?? 0)),
          sourceText: item.sourceText ?? item.source_text ?? "",
          sourcePage: item.sourcePage ?? item.source_page ?? null,
          status: item.status ?? "pending"
        }))
      : [],
    rawText: data.rawText ?? data.raw_text ?? "",
    warnings: Array.isArray(data.warnings) ? data.warnings : []
  };
}

export default function SetupProfile() {
  const navigate = useNavigate();
  const { extractionId } = useParams();

  const [ocrStatus, setOcrStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    confirmedProfile,
    localDraft,
    extractionDraft,
    selectedChanges,
    isDirty,
    setConfirmedProfile,
    initDraftFromConfirmed,
    updateDraftField,
    updateDraftTractionField,
    updateDraftTeamMembers,
    updateDraftUseOfFunds,
    setExtractionDraft,
    updateExtractionFieldStatus,
    mergeAcceptedExtractionFields,
    setSelectedChanges,
    resetDraft,
    cancelDraft,
  } = useStartupStore();

  const [activeTab, setActiveTab] = useState<'direct' | 'ocr' | 'doc' | 'history'>('direct');
  const [formStep, setFormStep] = useState<number>(1);
  const [showComparison, setShowComparison] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  const [newCustomFields, setNewCustomFields] = useState<string[]>([]);
  const [editingCustomField, setEditingCustomField] = useState<any>(null);
  const [customFieldEditValue, setCustomFieldEditValue] = useState<string>('');

  // Lists for dropdown selections
  const industriesList = ['Agritech', 'FinTech', 'SaaS', 'HealthTech', 'Logistics', 'Greentech', 'Biotech', 'Education Technology', 'E-commerce', 'AI/Deeptech'];
  const technologiesList = ['Machine Learning', 'Computer Vision', 'IoT', 'Blockchain', 'React/Node', 'Robotics', 'API Integration', 'Advanced Materials'];
  const marketsList = ['Vietnam', 'Southeast Asia', 'Global', 'Europe', 'North America', 'Japan'];
  const stagesList = ['idea', 'prototype', 'mvp', 'pre-seed', 'seed', 'growth', 'expansion'];
  const partnershipNeedsList = ['investment', 'pilot', 'distribution', 'research', 'technology_partnership', 'mentoring', 'customer_acquisition'];

  // History State
  const [versions, setVersions] = useState<ProfileVersionDTO[]>([]);
  const [restorePreview, setRestorePreview] = useState<{ profileData: Partial<StartupProfileDTO>; differences: any[] } | null>(null);

  // Load profile context
  const loadProfile = async () => {
    try {
      const res = await api.get('/startup/profile');
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load profile', e);
    }
  };

  const loadVersions = async () => {
    try {
      const res = await api.get('/startup/profile/versions');
      if (res.data && res.data.success) {
        setVersions(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load versions', e);
    }
  };

  const loadExtraction = async (extId: string) => {
    setOcrStatus('processing');
    setOcrError(null);
    try {
      const res = await api.get(`/startup/extractions/${extId}`);
      if (res.data && res.data.success) {
        const normalized = normalizeExtractionResponse(res.data.data);
        setExtractionDraft(normalized);
        setOcrStatus('completed');
      } else {
        throw new Error(res.data?.message || 'Không tìm thấy kết quả phân tích');
      }
    } catch (e: any) {
      console.error('Failed to load extraction', e);
      setOcrStatus('error');
      setOcrError(e.response?.data?.message || e.message || 'Lỗi tải kết quả phân tích.');
    }
  };

  useEffect(() => {
    loadProfile().then(() => {
      initDraftFromConfirmed();
    });
    loadVersions();
  }, []);

  useEffect(() => {
    if (extractionId) {
      if (extractionId.startsWith('ext-img')) {
        setActiveTab('ocr');
      } else if (extractionId.startsWith('ext-doc')) {
        setActiveTab('doc');
      }
      loadExtraction(extractionId);
    } else {
      setExtractionDraft(null);
      setOcrStatus('idle');
      setOcrError(null);
      setImagePreviewUrl(null);
    }
  }, [extractionId]);

  // Sync state helpers
  const handleFieldChange = (field: keyof StartupProfileDTO, val: any) => {
    updateDraftField(field, val);
  };

  const handleTractionChange = (field: keyof StartupProfileDTO['traction'], val: any) => {
    updateDraftTractionField(field, val);
  };

  // Team Members dynamic helpers
  const handleAddTeamMember = () => {
    const currentMembers = localDraft?.teamMembers || [];
    const newMember: TeamMemberDTO = {
      id: `tm-${Date.now()}`,
      fullName: '',
      position: '',
      experience: '',
      skills: [],
    };
    updateDraftTeamMembers([...currentMembers, newMember]);
  };

  const handleRemoveTeamMember = (id: string) => {
    const currentMembers = localDraft?.teamMembers || [];
    updateDraftTeamMembers(currentMembers.filter((m) => m.id !== id));
  };

  const handleUpdateTeamMember = (id: string, field: keyof TeamMemberDTO, val: any) => {
    const currentMembers = localDraft?.teamMembers || [];
    const updated = currentMembers.map((m) => {
      if (m.id === id) {
        return { ...m, [field]: val };
      }
      return m;
    });
    updateDraftTeamMembers(updated);
  };

  // Use of funds dynamic helpers
  const handleAddUseOfFunds = () => {
    const currentFunds = localDraft?.useOfFunds || [];
    const newFund: UseOfFundsDTO = {
      category: '',
      percentage: 0,
      description: '',
    };
    updateDraftUseOfFunds([...currentFunds, newFund]);
  };

  const handleRemoveUseOfFunds = (idx: number) => {
    const currentFunds = localDraft?.useOfFunds || [];
    const updated = [...currentFunds];
    updated.splice(idx, 1);
    updateDraftUseOfFunds(updated);
  };

  const handleUpdateUseOfFunds = (idx: number, field: keyof UseOfFundsDTO, val: any) => {
    const currentFunds = localDraft?.useOfFunds || [];
    const updated = currentFunds.map((item, index) => {
      if (index === idx) {
        return { ...item, [field]: val };
      }
      return item;
    });
    updateDraftUseOfFunds(updated);
  };

  // Image upload handler (Multipart Form-Data OCR)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn một file ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }

    setExtractionDraft(null);
    setOcrError(null);
    setOcrStatus('uploading');

    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);

    uploadAndAnalyzeImage(file);
  };

  const uploadAndAnalyzeImage = async (file: File) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setOcrStatus('processing');
    const toastId = toast.loading('Đang gửi ảnh lên Gemini AI OCR để phân tích...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/startup/extractions/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal: controller.signal,
      });

      if (res.data && res.data.success) {
        const payload = res.data.data;
        setConfirmedProfile(payload.profile);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(payload.profile)),
          isDirty: false,
        });

        // Set highlights and dynamic fields
        setHighlightedFields(payload.updatedFields || []);
        setNewCustomFields(payload.createdCustomFields || []);

        setOcrStatus('completed');
        
        const updatedCount = payload.updatedFields?.length || 0;
        const customCount = payload.createdCustomFields?.length || 0;
        const conflictCount = payload.conflictingFields?.filter((c: any) => c.status === 'pending_review').length || 0;
        
        toast.success(`Đồng bộ AI hoàn tất! Tự động điền ${updatedCount} trường, phát hiện ${customCount} trường mở rộng, ${conflictCount} xung đột cần xem xét.`);
        setActiveTab('direct');
        setImagePreviewUrl(null);
        navigate('/setup');
      } else {
        throw new Error(res.data?.message || 'Không nhận được kết quả OCR từ máy chủ.');
      }
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log('Request cancelled:', err.message);
        return;
      }
      console.error('OCR failed', err);
      setOcrStatus('error');
      setOcrError(err.response?.data?.message || err.message || 'Lỗi bất ngờ trong quá trình OCR.');
      toast.error('Phân tích OCR thất bại.');
    } finally {
      toast.dismiss(toastId);
    }
  };

  // Document upload handler
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check extensions
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (ext === '.doc' || ext === '.ppt') {
      toast.error('Hệ thống không hỗ trợ định dạng file cũ (.doc, .ppt). Vui lòng đổi sang .docx hoặc .pptx.');
      return;
    }

    const allowedExtensions = ['.pdf', '.docx', '.pptx'];
    if (!allowedExtensions.includes(ext)) {
      toast.error('Tài liệu phải là định dạng PDF, DOCX hoặc PPTX.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Dung lượng tài liệu không được vượt quá 25MB.');
      return;
    }

    setOcrError(null);
    setOcrStatus('uploading');

    const toastId = toast.loading('Đang gửi tài liệu lên hệ thống để phân tích cấu trúc & nội dung bằng Gemini AI...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      setOcrStatus('processing');
      const res = await api.post('/startup/extractions/document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data && res.data.success) {
        const payload = res.data.data;
        setConfirmedProfile(payload.profile);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(payload.profile)),
          isDirty: false,
        });

        // Set highlights and dynamic fields
        setHighlightedFields(payload.updatedFields || []);
        setNewCustomFields(payload.createdCustomFields || []);

        setOcrStatus('completed');

        const updatedCount = payload.updatedFields?.length || 0;
        const customCount = payload.createdCustomFields?.length || 0;
        const conflictCount = payload.conflictingFields?.filter((c: any) => c.status === 'pending_review').length || 0;
        
        toast.success(`Đồng bộ AI hoàn tất! Tự động điền ${updatedCount} trường, phát hiện ${customCount} trường mở rộng, ${conflictCount} xung đột cần xem xét.`);
        setActiveTab('direct');
        navigate('/setup');
      } else {
        throw new Error(res.data?.message || 'Không nhận được phản hồi hợp lệ từ máy chủ.');
      }
    } catch (err: any) {
      console.error('Doc parse failed', err);
      setOcrStatus('error');
      const errorMsg = err.response?.data?.message || err.message || 'Lỗi phân tích tài liệu.';
      setOcrError(errorMsg);
      toast.error(`Có lỗi xảy ra: ${errorMsg}`);
    } finally {
      toast.dismiss(toastId);
    }
  };

  // Merge Extraction draft into Local draft
  const handleMergeExtraction = () => {
    mergeAcceptedExtractionFields();
    toast.success('Đã tích hợp các trường được duyệt vào Hồ sơ nháp cục bộ.');
    setOcrStatus('idle');
    setOcrError(null);
    setImagePreviewUrl(null);
    setActiveTab('direct');
    navigate('/setup');
  };

  const handleCancelDraft = () => {
    cancelDraft();
    setOcrStatus('idle');
    setOcrError(null);
    setImagePreviewUrl(null);
    navigate('/setup');
  };

  // Save changes from Comparison screen
  const handleSaveConfirmedProfile = async () => {
    if (!localDraft) return;
    setIsSaving(true);
    const toastId = toast.loading('Đang ghi nhận thay đổi hồ sơ vào Supabase...');

    try {
      const isCreate = !confirmedProfile;
      const url = isCreate ? '/startup/profile/confirm-create' : '/startup/profile/confirm-update';
      const method = isCreate ? 'post' : 'patch';

      const payload = isCreate ? localDraft : {
        fieldsToApply: selectedChanges,
        localDraft,
      };

      const res = await api[method](url, payload);

      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
          selectedChanges: [],
        });
        toast.success(isCreate ? 'Khởi tạo hồ sơ startup chính thức thành công!' : 'Đã cập nhật phiên bản hồ sơ startup mới!');
        setShowComparison(false);
        loadVersions();
      }
    } catch (e) {
      console.error('Failed to commit profile', e);
    } finally {
      setIsSaving(false);
      toast.dismiss(toastId);
    }
  };

  // History Version restore trigger
  const handleTriggerRestore = async (versionId: string) => {
    const toastId = toast.loading('Đang so sánh sự khác biệt của phiên bản khôi phục...');
    try {
      const res = await api.post(`/startup/profile/versions/${versionId}/restore-preview`);
      if (res.data && res.data.success) {
        setRestorePreview(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleConfirmRestore = async (versionId: string) => {
    const toastId = toast.loading('Đang tiến hành khôi phục...');
    try {
      const res = await api.post(`/startup/profile/versions/${versionId}/confirm-restore`);
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        setRestorePreview(null);
        toast.success('Đã khôi phục về phiên bản cũ thành công!');
        loadVersions();
      }
    } catch (e) {
      console.error(e);
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleResolveConflict = async (fieldKey: string, choice: 'current' | 'proposed') => {
    if (!localDraft) return;

    const conflict = localDraft.conflictingFields?.find(c => c.field === fieldKey);
    if (!conflict) return;

    const updatedProfile = JSON.parse(JSON.stringify(localDraft));

    if (choice === 'proposed') {
      const val = conflict.proposedValue;
      if (fieldKey.startsWith('custom_')) {
        const cfKey = fieldKey.replace('custom_', '');
        if (updatedProfile.customFields) {
          const idx = updatedProfile.customFields.findIndex((cf: any) => cf.key === cfKey);
          if (idx !== -1) {
            updatedProfile.customFields[idx].value = val;
            updatedProfile.customFields[idx].requiresConfirmation = false;
          }
        }
      } else if (fieldKey.startsWith('traction') && fieldKey !== 'tractionAchievements') {
        const tractionKey = fieldKey.replace('traction', '');
        const key = tractionKey.charAt(0).toLowerCase() + tractionKey.slice(1);
        if (updatedProfile.traction) {
          updatedProfile.traction[key] = val;
        }
      } else if (fieldKey === 'tractionAchievements') {
        if (updatedProfile.traction) {
          updatedProfile.traction.achievements = val;
        }
      } else {
        updatedProfile[fieldKey as keyof StartupProfileDTO] = val;
      }
    }

    // Mark conflict as resolved
    updatedProfile.conflictingFields = updatedProfile.conflictingFields.map((c: any) => {
      if (c.field === fieldKey) {
        return { ...c, status: 'resolved' };
      }
      return c;
    });

    const toastId = toast.loading('Đang ghi nhận lựa chọn...');
    try {
      const res = await api.patch('/startup/profile/confirm-update', { localDraft: updatedProfile });
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
        });
        toast.success(`Đã xử lý xung đột trường ${FIELD_LABELS[fieldKey] || fieldKey}!`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi lưu lựa chọn.');
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleConfirmCustomField = async (cfKey: string) => {
    if (!localDraft) return;

    const updatedProfile = JSON.parse(JSON.stringify(localDraft));
    if (updatedProfile.customFields) {
      updatedProfile.customFields = updatedProfile.customFields.map((cf: any) => {
        if (cf.key === cfKey) {
          return { ...cf, requiresConfirmation: false };
        }
        return cf;
      });
    }

    const toastId = toast.loading('Đang xác nhận trường...');
    try {
      const res = await api.patch('/startup/profile/confirm-update', { localDraft: updatedProfile });
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
        });
        toast.success('Đã xác nhận trường mở rộng thành công!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi xác nhận trường.');
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleDeleteCustomField = async (cfKey: string) => {
    if (!localDraft) return;

    const updatedProfile = JSON.parse(JSON.stringify(localDraft));
    if (updatedProfile.customFields) {
      updatedProfile.customFields = updatedProfile.customFields.filter((cf: any) => cf.key !== cfKey);
    }

    const toastId = toast.loading('Đang xóa trường...');
    try {
      const res = await api.patch('/startup/profile/confirm-update', { localDraft: updatedProfile });
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
        });
        toast.success('Đã xóa trường mở rộng thành công!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi xóa trường.');
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleEditCustomField = (cf: any) => {
    setEditingCustomField(cf);
    setCustomFieldEditValue(Array.isArray(cf.value) ? cf.value.join(', ') : String(cf.value));
  };

  const handleSaveCustomFieldEdit = async () => {
    if (!localDraft || !editingCustomField) return;

    const updatedProfile = JSON.parse(JSON.stringify(localDraft));
    let parsedVal: any = customFieldEditValue;
    if (editingCustomField.type === 'list') {
      parsedVal = customFieldEditValue.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (updatedProfile.customFields) {
      updatedProfile.customFields = updatedProfile.customFields.map((cf: any) => {
        if (cf.key === editingCustomField.key) {
          return {
            ...cf,
            value: parsedVal,
            requiresConfirmation: false
          };
        }
        return cf;
      });
    }

    const toastId = toast.loading('Đang cập nhật thay đổi...');
    try {
      const res = await api.patch('/startup/profile/confirm-update', { localDraft: updatedProfile });
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
        });
        toast.success('Đã cập nhật trường mở rộng thành công!');
        setEditingCustomField(null);
      }
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi cập nhật trường.');
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleToggleTag = (field: 'industries' | 'technologies' | 'markets' | 'partnershipNeeds', value: string) => {
    const current = (localDraft?.[field] as string[]) || [];
    if (current.includes(value)) {
      handleFieldChange(field, current.filter((x) => x !== value));
    } else {
      handleFieldChange(field, [...current, value]);
    }
  };

  const getFieldClassName = (fieldName: string) => {
    const isHighlighted = highlightedFields.includes(fieldName);
    return `mt-1.5 block w-full bg-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
      isHighlighted
        ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/10'
        : 'border-slate-300 focus:ring-emerald-500'
    }`;
  };

  const renderFieldBadge = (fieldName: string) => {
    if (highlightedFields.includes(fieldName)) {
      return (
        <span className="text-[10px] text-emerald-600 font-bold ml-1.5 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center inline-flex">
          <Sparkles className="h-2.5 w-2.5 mr-0.5 animate-pulse" /> AI cập nhật
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Navigation Headers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">Thiết lập Hồ sơ Startup</h2>
          <p className="text-sm text-slate-500 mt-1">Cung cấp và đồng bộ hóa các chỉ số hoạt động cốt lõi của doanh nghiệp</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveTab('direct')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'direct' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Nhập trực tiếp
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'ocr' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tải ảnh (OCR)
          </button>
          <button
            onClick={() => setActiveTab('doc')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'doc' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tải tài liệu (Pitch Deck)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Lịch sử phiên bản</span>
          </button>
        </div>
      </div>

      {/* Comparisons Panel Modal Overlay */}
      {showComparison && localDraft && (
        <CompareChanges
          currentProfile={confirmedProfile}
          draftProfile={localDraft}
          selectedFields={selectedChanges}
          onChangeSelection={setSelectedChanges}
          onConfirm={handleSaveConfirmedProfile}
          onCancel={() => setShowComparison(false)}
          isSaving={isSaving}
        />
      )}

      {/* History Restore Comparison Overlay */}
      {restorePreview && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-6 overflow-y-auto z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-display">So sánh khôi phục phiên bản cũ</h3>
              <p className="text-sm text-slate-500 mt-1">Xem lại sự thay đổi trước khi ghi đè lại hồ sơ chính thức của bạn.</p>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase">
                    <th className="p-3">Trường</th>
                    <th className="p-3">Hồ sơ hiện tại</th>
                    <th className="p-3 bg-amber-50/50 text-amber-950">Khôi phục đề xuất</th>
                  </tr>
                </thead>
                <tbody>
                  {restorePreview.differences.map((d: any) => (
                    <tr key={d.field} className="border-b border-slate-100">
                      <td className="p-3 font-bold text-slate-700">{FIELD_LABELS[d.field] || d.field}</td>
                      <td className="p-3 text-slate-500 line-through">{String(d.currentValue || 'Chưa có')}</td>
                      <td className="p-3 bg-amber-50/20 text-slate-950 font-medium">{String(d.proposedValue || 'Chưa có')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setRestorePreview(null)}
                className="px-4 py-2 text-sm font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Hủy khôi phục
              </button>
              <button
                onClick={() => handleConfirmRestore(versions[0]?.id)} // Restore selected version
                className="px-5 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Xác nhận khôi phục phiên bản này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENDER ACTIVE TAB CORES */}

      {/* 1. DIRECT FORM WIZARD */}
      {activeTab === 'direct' && !showComparison && localDraft && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6 space-y-6">
          {/* Conflict Resolution Banner */}
          {localDraft.conflictingFields && localDraft.conflictingFields.filter((c: any) => c.status === 'pending_review').length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4 shadow-sm mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 animate-bounce" />
                <h4 className="font-bold text-amber-900 text-sm">Phát hiện xung đột dữ liệu từ AI</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gemini AI đã trích xuất được thông tin mới khác biệt so với hồ sơ hiện tại. Vui lòng chọn giá trị chính xác để cập nhật:
              </p>
              
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {localDraft.conflictingFields.filter((c: any) => c.status === 'pending_review').map((c: any) => {
                  const fieldLabel = FIELD_LABELS[c.field] || c.field.replace('traction.', 'Traction: ');
                  return (
                    <div key={c.field} className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-sm">
                      <div className="min-w-[120px]">
                        <span className="font-bold text-slate-700">{fieldLabel}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveConflict(c.field, 'current')}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          Giữ cũ: <span className="text-slate-500 italic font-normal">{Array.isArray(c.currentValue) ? c.currentValue.join(', ') : String(c.currentValue || 'Trống')}</span>
                        </button>
                        <span className="text-slate-400 font-medium">hoặc</span>
                        <button
                          type="button"
                          onClick={() => handleResolveConflict(c.field, 'proposed')}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                        >
                          <Sparkles className="h-3 w-3 text-emerald-600" />
                          <span>Dùng mới: {Array.isArray(c.proposedValue) ? c.proposedValue.join(', ') : String(c.proposedValue || 'Trống')}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step Badges Progress */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-500">Bước {formStep} / 5: {
              formStep === 1 ? 'Thông tin cơ bản' :
              formStep === 2 ? 'Sản phẩm & Giải pháp' :
              formStep === 3 ? 'Chỉ số & Traction' :
              formStep === 4 ? 'Đội ngũ sáng lập' :
              'Nhu cầu vốn & Hợp tác'
            }</span>

            <div className="flex space-x-1.5">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`h-2.5 w-8 rounded-full ${
                    formStep === step ? 'bg-emerald-600' : formStep > step ? 'bg-emerald-200' : 'bg-slate-100'
                  }`}
                ></div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* STEP 1: BASIC INFO */}
            {formStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Tên Startup *
                    {renderFieldBadge('startupName')}
                  </label>
                  <input
                    type="text"
                    value={localDraft.startupName || ''}
                    onChange={(e) => handleFieldChange('startupName', e.target.value)}
                    className={getFieldClassName('startupName')}
                    placeholder="BioPack Green"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Địa chỉ Website (URL)
                    {renderFieldBadge('website')}
                  </label>
                  <input
                    type="url"
                    value={localDraft.website || ''}
                    onChange={(e) => handleFieldChange('website', e.target.value)}
                    className={getFieldClassName('website')}
                    placeholder="https://biopack.vn"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Năm thành lập
                    {renderFieldBadge('foundingYear')}
                  </label>
                  <input
                    type="number"
                    value={localDraft.foundingYear || ''}
                    onChange={(e) => handleFieldChange('foundingYear', Number(e.target.value) || null)}
                    className={getFieldClassName('foundingYear')}
                    placeholder="2025"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Địa chỉ trụ sở
                    {renderFieldBadge('address')}
                  </label>
                  <input
                    type="text"
                    value={localDraft.address || ''}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    className={getFieldClassName('address')}
                    placeholder="Q1, TP. Hồ Chí Minh"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Quốc gia hoạt động
                    {renderFieldBadge('country')}
                  </label>
                  <input
                    type="text"
                    value={localDraft.country || ''}
                    onChange={(e) => handleFieldChange('country', e.target.value)}
                    className={getFieldClassName('country')}
                    placeholder="Vietnam"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Email liên hệ công việc *
                    {renderFieldBadge('contactEmail')}
                  </label>
                  <input
                    type="email"
                    value={localDraft.contactEmail || ''}
                    onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
                    className={getFieldClassName('contactEmail')}
                    placeholder="founders@biopack.vn"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: PRODUCT & SOLUTION */}
            {formStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Mô tả ngắn về mô hình Startup
                    {renderFieldBadge('description')}
                  </label>
                  <textarea
                    rows={2}
                    value={localDraft.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    className={getFieldClassName('description')}
                    placeholder="Nhập 1 câu mô tả ngắn về startup..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">
                      Vấn đề đang giải quyết
                      {renderFieldBadge('problemStatement')}
                    </label>
                    <textarea
                      rows={3}
                      value={localDraft.problemStatement || ''}
                      onChange={(e) => handleFieldChange('problemStatement', e.target.value)}
                      className={getFieldClassName('problemStatement')}
                      placeholder="Nêu ra vấn đề thực tế nhức nhối..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">
                      Giải pháp của bạn
                      {renderFieldBadge('solutionDescription')}
                    </label>
                    <textarea
                      rows={3}
                      value={localDraft.solutionDescription || ''}
                      onChange={(e) => handleFieldChange('solutionDescription', e.target.value)}
                      className={getFieldClassName('solutionDescription')}
                      placeholder="Giải pháp công nghệ hay kinh doanh xử lý vấn đề trên..."
                    />
                  </div>
                </div>

                {/* Industries selection tags */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Lĩnh vực hoạt động (Chọn nhiều)
                    {renderFieldBadge('industries')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {industriesList.map((ind) => {
                      const isSelected = localDraft.industries?.includes(ind);
                      return (
                        <button
                          key={ind}
                          type="button"
                          onClick={() => handleToggleTag('industries', ind)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {ind}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Technologies selection tags */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Công nghệ cốt lõi (Chọn nhiều)
                    {renderFieldBadge('technologies')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {technologiesList.map((tech) => {
                      const isSelected = localDraft.technologies?.includes(tech);
                      return (
                        <button
                          key={tech}
                          type="button"
                          onClick={() => handleToggleTag('technologies', tech)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {tech}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: TRACTION */}
            {formStep === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">
                      Số lượng khách hàng (Doanh nghiệp/B2B)
                      {renderFieldBadge('tractionCustomerCount')}
                    </label>
                    <input
                      type="number"
                      value={localDraft.traction?.customerCount || ''}
                      onChange={(e) => handleTractionChange('customerCount', Number(e.target.value) || null)}
                      className={getFieldClassName('tractionCustomerCount')}
                      placeholder="20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">
                      Số lượng người dùng active (B2C)
                      {renderFieldBadge('tractionUserCount')}
                    </label>
                    <input
                      type="number"
                      value={localDraft.traction?.userCount || ''}
                      onChange={(e) => handleTractionChange('userCount', Number(e.target.value) || null)}
                      className={getFieldClassName('tractionUserCount')}
                      placeholder="10000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">
                      Doanh thu trung bình hàng tháng (MRR)
                      {renderFieldBadge('tractionMonthlyRevenue')}
                    </label>
                    <input
                      type="number"
                      value={localDraft.traction?.monthlyRevenue || ''}
                      onChange={(e) => handleTractionChange('monthlyRevenue', Number(e.target.value) || null)}
                      className={getFieldClassName('tractionMonthlyRevenue')}
                      placeholder="5000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">
                      Tốc độ tăng trưởng hàng năm (%)
                      {renderFieldBadge('tractionGrowthRate')}
                    </label>
                    <input
                      type="number"
                      value={localDraft.traction?.growthRate || ''}
                      onChange={(e) => handleTractionChange('growthRate', Number(e.target.value) || null)}
                      className={getFieldClassName('tractionGrowthRate')}
                      placeholder="25"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Thành tựu nổi bật đạt được
                    {renderFieldBadge('tractionAchievements')}
                  </label>
                  <textarea
                    rows={2}
                    value={localDraft.traction?.achievements?.join('\n') || ''}
                    onChange={(e) => handleTractionChange('achievements', e.target.value.split('\n').filter(Boolean))}
                    className={getFieldClassName('tractionAchievements')}
                    placeholder="Mỗi thành tựu 1 dòng:&#10;- Top 10 Techfest Vietnam&#10;- Nhận gói tài trợ AWS 10k USD"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: TEAM MEMBERS */}
            {formStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">Thành viên đội ngũ sáng lập ({localDraft.teamMembers?.length || 0})</h4>
                  <button
                    type="button"
                    onClick={handleAddTeamMember}
                    className="inline-flex items-center space-x-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm thành viên</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {(localDraft.teamMembers || []).map((member, idx) => (
                    <div key={member.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative space-y-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamMember(member.id!)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Họ và tên</label>
                          <input
                            type="text"
                            value={member.fullName}
                            onChange={(e) => handleUpdateTeamMember(member.id!, 'fullName', e.target.value)}
                            className="mt-1 block w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Nguyễn Văn B"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Chức vụ (Position)</label>
                          <input
                            type="text"
                            value={member.position}
                            onChange={(e) => handleUpdateTeamMember(member.id!, 'position', e.target.value)}
                            className="mt-1 block w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Co-founder & CTO"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Kinh nghiệm nổi bật</label>
                          <input
                            type="text"
                            value={member.experience}
                            onChange={(e) => handleUpdateTeamMember(member.id!, 'experience', e.target.value)}
                            className="mt-1 block w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="5 năm kinh nghiệm mảng ML tại tập đoàn lớn..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: FUNDING & PARTNERSHIP */}
            {formStep === 5 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Số vốn mong muốn gọi (Funding Need)
                      {renderFieldBadge('fundingNeed')}
                    </label>
                    <input
                      type="number"
                      value={localDraft.fundingNeed || ''}
                      onChange={(e) => handleFieldChange('fundingNeed', Number(e.target.value) || null)}
                      className={getFieldClassName('fundingNeed')}
                      placeholder="200000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Đơn vị tiền tệ</label>
                    <select
                      value={localDraft.currency}
                      onChange={(e) => handleFieldChange('currency', e.target.value)}
                      className="mt-1.5 block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="VND">VND (đ)</option>
                    </select>
                  </div>
                </div>

                {/* Markets Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Thị trường mở rộng mong muốn (Markets)
                    {renderFieldBadge('markets')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {marketsList.map((m) => {
                      const isSelected = localDraft.markets?.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleToggleTag('markets', m)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Partnership Types Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Hình thức hợp tác tìm kiếm (Chọn nhiều)
                    {renderFieldBadge('partnershipNeeds')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {partnershipNeedsList.map((need) => {
                      const isSelected = localDraft.partnershipNeeds?.includes(need);
                      return (
                        <button
                          key={need}
                          type="button"
                          onClick={() => handleToggleTag('partnershipNeeds', need)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {need.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Onboarding startup stage select */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Giai đoạn phát triển hiện tại
                    {renderFieldBadge('stage')}
                  </label>
                  <select
                    value={localDraft.stage}
                    onChange={(e) => handleFieldChange('stage', e.target.value)}
                    className="mt-1.5 block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Chọn giai đoạn...</option>
                    {stagesList.map((stg) => (
                      <option key={stg} value={stg} className="capitalize">
                        {stg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              type="button"
              disabled={formStep === 1}
              onClick={() => setFormStep(formStep - 1)}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 transition-colors disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Quay lại</span>
            </button>

            {formStep < 5 ? (
              <button
                type="button"
                onClick={() => setFormStep(formStep + 1)}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-slate-950 text-white hover:bg-slate-800 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <span>Tiếp tục</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedChanges([]); // reset comparisons selection
                  setShowComparison(true);
                }}
                className="inline-flex items-center space-x-1.5 px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold shadow-md transition-colors cursor-pointer"
              >
                <CheckCircle className="h-4.5 w-4.5 animate-bounce" />
                <span>Xem so sánh &amp; Xác nhận lưu</span>
              </button>
            )}
          </div>

          {/* Custom/Extended Fields Section */}
          {localDraft.customFields && localDraft.customFields.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4 mt-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <PlusCircle className="h-5 w-5 text-emerald-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Thông tin mở rộng (AI phát hiện)</h4>
                </div>
                <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {localDraft.customFields.length} trường
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Các thông tin sau đây được AI trích xuất từ tài liệu của bạn nhưng không nằm trong các trường form chuẩn. Bạn có thể duyệt, sửa hoặc xóa chúng:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localDraft.customFields.map((cf: any) => {
                  const isNew = newCustomFields.includes(cf.key);
                  return (
                    <div 
                      key={cf.key} 
                      className={`bg-white border rounded-xl p-4 space-y-3 shadow-sm transition-all relative overflow-hidden ${
                        cf.requiresConfirmation 
                          ? 'border-amber-300 bg-amber-50/5' 
                          : isNew
                            ? 'border-emerald-300 bg-emerald-50/5'
                            : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Top header row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            {cf.category || 'Thông tin thêm'}
                          </span>
                          <h5 className="font-bold text-slate-800 text-sm mt-0.5">{cf.label}</h5>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          {cf.requiresConfirmation && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold flex items-center mr-1">
                              <AlertCircle className="h-3 w-3 mr-0.5" /> Chờ duyệt
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditCustomField(cf)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Chỉnh sửa"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomField(cf.key)}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Xóa trường"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Value content */}
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        {Array.isArray(cf.value) ? (
                          <div className="flex flex-wrap gap-1.5">
                            {cf.value.map((v: any, idx: number) => (
                              <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-xs text-slate-700 font-medium">
                                {String(v)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                            {String(cf.value)}
                          </span>
                        )}
                      </div>

                      {/* Source attribution and actions */}
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-400 italic">
                          Độ tin cậy: {Math.round((cf.confidence || 0.9) * 100)}%
                        </span>
                        
                        {cf.requiresConfirmation && (
                          <button
                            type="button"
                            onClick={() => handleConfirmCustomField(cf.key)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-sm transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Xác nhận</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. IMAGE UPLOAD TAB */}
      {activeTab === 'ocr' && (
        <div className="space-y-6">
          {ocrStatus === 'idle' && !extractionDraft && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
                <UploadCloud className="h-8 w-8" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-bold text-slate-900 font-display">Tải ảnh chụp chỉ số hay bảng tóm tắt</h3>
                <p className="text-sm text-slate-500 leading-normal">
                  Hỗ trợ định dạng JPG, JPEG, PNG, WEBP. Hệ thống tích hợp Gemini 3.5 Flash để đọc chữ, OCR và cấu trúc hóa toàn bộ thông số kinh doanh.
                </p>
              </div>

              <div className="flex justify-center">
                <label className="relative inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm cursor-pointer transition-all">
                  <ImageIcon className="h-4.5 w-4.5" />
                  <span>Chọn ảnh từ thiết bị</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {(ocrStatus === 'uploading' || ocrStatus === 'processing') && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center space-y-6">
              {imagePreviewUrl && (
                <div className="max-w-xs mx-auto border border-slate-200 rounded-lg overflow-hidden shadow-sm relative animate-pulse">
                  <img src={imagePreviewUrl} alt="Preview" className="w-full h-auto object-cover opacity-60" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center" />
                </div>
              )}
              
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-slate-700">
                  {ocrStatus === 'uploading' ? 'Đang tải hình ảnh lên...' : 'Đang phân tích hình ảnh bằng Gemini AI...'}
                </p>
                <p className="text-xs text-slate-400">Quá trình này có thể mất vài giây. Vui lòng giữ nguyên màn hình.</p>
              </div>

              {/* Skeleton reviews list to prevent unstyled flash */}
              <div className="space-y-3 max-w-xl mx-auto pt-4 border-t border-slate-100">
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse w-full"></div>
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse w-5/6"></div>
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse w-4/5"></div>
              </div>
            </div>
          )}

          {ocrStatus === 'error' && (
            <div className="bg-white border border-rose-100 rounded-xl shadow-sm p-8 text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
                <AlertTriangle className="h-8 w-8" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-bold text-slate-900 font-display">Lỗi phân tích hình ảnh</h3>
                <p className="text-sm text-rose-600 font-medium leading-relaxed max-w-lg mx-auto">
                  {ocrError || 'Đã xảy ra lỗi bất ngờ khi gửi hoặc phân tích ảnh bằng Gemini.'}
                </p>
              </div>

              <div className="flex justify-center space-x-3">
                <label className="relative inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm cursor-pointer transition-all">
                  <ImageIcon className="h-4.5 w-4.5" />
                  <span>Chọn ảnh khác</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
                <button
                  onClick={() => {
                    setOcrStatus('idle');
                    setOcrError(null);
                    setImagePreviewUrl(null);
                    setExtractionDraft(null);
                    navigate('/setup');
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Quay lại
                </button>
              </div>
            </div>
          )}

          {extractionDraft && (ocrStatus === 'completed' || ocrStatus === 'idle') && (
            <div className="space-y-4">
              {imagePreviewUrl && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center space-x-4">
                  <div className="h-16 w-16 rounded overflow-hidden border border-slate-200 shrink-0">
                    <img src={imagePreviewUrl} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Ảnh đang xem xét</h4>
                    <p className="text-xs text-slate-400">Bạn có thể chọn ảnh khác bất kỳ lúc nào để phân tích lại.</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <label className="relative inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer transition-all">
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>Thay đổi ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}
              
              <ExtractionReview
                currentProfile={confirmedProfile}
                extractionDraft={extractionDraft}
                onUpdateFieldStatus={updateExtractionFieldStatus}
                onMergeAllAccepted={handleMergeExtraction}
                onDismissAll={handleCancelDraft}
              />
            </div>
          )}
        </div>
      )}

      {/* 3. DOCUMENT UPLOAD TAB */}
      {activeTab === 'doc' && (
        <div className="space-y-6">
          {!extractionDraft ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
                <UploadCloud className="h-8 w-8" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-bold text-slate-900 font-display">Tải lên Pitch Deck / Kế hoạch kinh doanh</h3>
                <p className="text-sm text-slate-500 leading-normal">
                  Hỗ trợ các file tài liệu PDF, DOCX, PPTX. Gemini AI sẽ đọc nội dung văn bản và tự động chuẩn hóa thành các trường thông tin cho bạn.
                </p>
              </div>

              <div className="flex justify-center">
                <label className="relative inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm cursor-pointer transition-all">
                  <FileText className="h-4.5 w-4.5" />
                  <span>Chọn tài liệu từ thiết bị</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx"
                    onChange={handleDocUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          ) : (
            <ExtractionReview
              currentProfile={confirmedProfile}
              extractionDraft={extractionDraft}
              onUpdateFieldStatus={updateExtractionFieldStatus}
              onMergeAllAccepted={handleMergeExtraction}
              onDismissAll={handleCancelDraft}
            />
          )}
        </div>
      )}

      {/* 4. HISTORICAL VERSIONS LIST */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display">Lịch sử sao lưu &amp; các phiên bản</h3>
            <p className="text-xs text-slate-500 mt-1">Lịch sử thay đổi được ghi nhận tự động mỗi khi bạn xác nhận cập nhật mới thành công.</p>
          </div>

          {versions.length > 0 ? (
            <div className="space-y-4">
              {versions.map((ver) => (
                <div key={ver.id} className="border border-slate-100 bg-slate-50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Phiên bản #{ver.versionNumber}</p>
                    <p className="text-xs text-slate-500">Bởi: {ver.confirmedBy} • {new Date(ver.createdAt).toLocaleString('vi-VN')}</p>
                    <p className="text-xs text-slate-700 italic mt-1">{ver.changeSummary.description}</p>
                  </div>

                  <button
                    onClick={() => handleTriggerRestore(ver.id)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors shrink-0 cursor-pointer"
                  >
                    Khôi phục phiên bản này
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm italic">
              Chưa có phiên bản lịch sử lưu trữ nào được phát hiện.
            </div>
          )}
        </div>
      )}

      {/* Custom Field Edit Modal */}
      {editingCustomField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-scale-up">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50">
              <h4 className="font-bold text-slate-800 text-sm">Chỉnh sửa thông tin mở rộng</h4>
              <button
                onClick={() => setEditingCustomField(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tên trường thông tin</label>
                <input
                  type="text"
                  disabled
                  value={editingCustomField.label}
                  className="block w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Giá trị</label>
                {editingCustomField.type === 'list' ? (
                  <div>
                    <input
                      type="text"
                      value={customFieldEditValue}
                      onChange={(e) => setCustomFieldEditValue(e.target.value)}
                      className="block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Giá trị 1, Giá trị 2,..."
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Phân cách các giá trị bằng dấu phẩy (,)</p>
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    value={customFieldEditValue}
                    onChange={(e) => setCustomFieldEditValue(e.target.value)}
                    className="block w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Nhập giá trị thông tin..."
                  />
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-3.5 flex justify-end space-x-2 bg-slate-50">
              <button
                onClick={() => setEditingCustomField(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveCustomFieldEdit}
                className="px-4.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
