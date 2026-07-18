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
import CompareChanges, { FIELD_LABELS, fieldLabel } from '../components/CompareChanges';
import ExtractionReview from '../components/ExtractionReview';
import { TeamMemberDTO, UseOfFundsDTO, StartupProfileDTO, ProfileVersionDTO } from '../../types';
import { toConfirmCreateBody, toConfirmUpdateBody } from '../profilePayload';
import { usePortalI18n } from '../i18n';
import { PortalHero } from '../components/PortalUI';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

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
  const { t, lang } = usePortalI18n();
  const tx = (vi: string, en: string) => (lang === 'vi' ? vi : en);
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

  const [activeTab, setActiveTab] = useState<'direct' | 'ocr' | 'doc' | 'history'>('doc');
  const [agreeTerms, setAgreeTerms] = useState(false);
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
        throw new Error(res.data?.message || tx('Không tìm thấy kết quả phân tích', 'Analysis result not found'));
      }
    } catch (e: any) {
      console.error('Failed to load extraction', e);
      setOcrStatus('error');
      setOcrError(e.response?.data?.message || e.message || tx('Lỗi tải kết quả phân tích.', 'Failed to load the analysis result.'));
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
      toast.error(tx('Vui lòng chọn một file ảnh hợp lệ (PNG, JPG, WEBP).', 'Please pick a valid image file (PNG, JPG, WEBP).'));
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
    const toastId = toast.loading(tx('Đang phân tích ảnh bằng AI (OCR)...', 'Analyzing image with AI (OCR)…'));

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Prefer same-origin /api/v1 (Next + GEMINI_API_KEY) for OCR reliability
      const res = await api.post('/startup/extractions/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal: controller.signal,
        // @ts-expect-error custom flag handled in interceptor — use local OCR path
        useLocalOcr: true,
      });

      if (res.data && res.data.success) {
        const payload = res.data.data;
        // OCR fills draft only — official confirm is a separate step
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(payload.profile)),
          isDirty: true,
        });

        // Set highlights and dynamic fields
        setHighlightedFields(payload.updatedFields || []);
        setNewCustomFields(payload.createdCustomFields || []);

        setOcrStatus('completed');
        
        const updatedCount = payload.updatedFields?.length || 0;
        const customCount = payload.createdCustomFields?.length || 0;
        const conflictCount = payload.conflictingFields?.filter((c: any) => c.status === 'pending_review').length || 0;
        
        toast.success(tx(`Đồng bộ AI hoàn tất! Tự động điền ${updatedCount} trường, phát hiện ${customCount} trường mở rộng, ${conflictCount} xung đột cần xem xét.`, `AI sync complete! Auto-filled ${updatedCount} fields, found ${customCount} extended fields, ${conflictCount} conflicts to review.`));
        setActiveTab('direct');
        setImagePreviewUrl(null);
        navigate('/setup');
      } else {
        throw new Error(res.data?.message || tx('Không nhận được kết quả OCR từ máy chủ.', 'No OCR result returned from the server.'));
      }
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log('Request cancelled:', err.message);
        return;
      }
      console.error('OCR failed', err);
      setOcrStatus('error');
      setOcrError(err.response?.data?.message || err.message || tx('Lỗi bất ngờ trong quá trình OCR.', 'Unexpected error during OCR.'));
      toast.error(tx('Phân tích OCR thất bại.', 'OCR analysis failed.'));
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
      toast.error(tx('Hệ thống không hỗ trợ định dạng file cũ (.doc, .ppt). Vui lòng đổi sang .docx hoặc .pptx.', 'Legacy formats (.doc, .ppt) are not supported. Please convert to .docx or .pptx.'));
      return;
    }

    const allowedExtensions = ['.pdf', '.docx', '.pptx'];
    if (!allowedExtensions.includes(ext)) {
      toast.error(tx('Tài liệu phải là định dạng PDF, DOCX hoặc PPTX.', 'Document must be PDF, DOCX, or PPTX.'));
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error(tx('Dung lượng tài liệu không được vượt quá 25MB.', 'Document size must not exceed 25MB.'));
      return;
    }

    setOcrError(null);
    setOcrStatus('uploading');

    const toastId = toast.loading(tx('Đang phân tích cấu trúc & nội dung tài liệu bằng AI...', 'Analyzing document structure & content with AI…'));

    const formData = new FormData();
    formData.append('file', file);

    try {
      setOcrStatus('processing');
      const res = await api.post('/startup/extractions/document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // @ts-expect-error local OCR bridge
        useLocalOcr: true,
      });

      if (res.data && res.data.success) {
        const payload = res.data.data;
        // Draft only until user runs confirm-create / confirm-update
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(payload.profile)),
          isDirty: true,
        });

        // Set highlights and dynamic fields
        setHighlightedFields(payload.updatedFields || []);
        setNewCustomFields(payload.createdCustomFields || []);

        setOcrStatus('completed');

        const updatedCount = payload.updatedFields?.length || 0;
        const customCount = payload.createdCustomFields?.length || 0;
        const conflictCount = payload.conflictingFields?.filter((c: any) => c.status === 'pending_review').length || 0;
        
        toast.success(tx(`Đồng bộ AI hoàn tất! Tự động điền ${updatedCount} trường, phát hiện ${customCount} trường mở rộng, ${conflictCount} xung đột cần xem xét.`, `AI sync complete! Auto-filled ${updatedCount} fields, found ${customCount} extended fields, ${conflictCount} conflicts to review.`));
        setActiveTab('direct');
        navigate('/setup');
      } else {
        throw new Error(res.data?.message || tx('Không nhận được phản hồi hợp lệ từ máy chủ.', 'No valid response from the server.'));
      }
    } catch (err: any) {
      console.error('Doc parse failed', err);
      setOcrStatus('error');
      const errorMsg = err.response?.data?.message || err.message || tx('Lỗi phân tích tài liệu.', 'Document analysis failed.');
      setOcrError(errorMsg);
      toast.error(tx(`Có lỗi xảy ra: ${errorMsg}`, `Something went wrong: ${errorMsg}`));
    } finally {
      toast.dismiss(toastId);
    }
  };

  // Merge Extraction draft into Local draft
  const handleMergeExtraction = () => {
    mergeAcceptedExtractionFields();
    toast.success(tx('Đã tích hợp các trường được duyệt vào Hồ sơ nháp cục bộ.', 'Approved fields merged into your local draft.'));
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
    if (!agreeTerms) {
      toast.error(
        tx(
          'Cần đồng ý Điều khoản & Chính sách bảo mật (tick ở bước xác nhận) trước khi lưu hồ sơ.',
          'You must agree to the Terms & Privacy Policy (tick at the confirm step) before saving.',
        ),
      );
      setShowComparison(false);
      setActiveTab('direct');
      setFormStep(5);
      return;
    }
    setIsSaving(true);
    const toastId = toast.loading(
      tx('Đang lưu hồ sơ chính thức…', 'Saving official profile…'),
    );

    try {
      // Trust the server: FE "confirmedProfile" may be a draft wrongly set by OCR
      let serverHasProfile = false;
      try {
        const check = await api.get('/startup/profile');
        serverHasProfile = !!(check.data?.success && check.data?.data);
        if (serverHasProfile) {
          setConfirmedProfile(check.data.data);
        }
      } catch {
        serverHasProfile = false;
      }

      let isCreate = !serverHasProfile;
      const createBody = toConfirmCreateBody(localDraft as any);

      const runCreate = () => api.post('/startup/profile/confirm-create', createBody);
      const runUpdate = () =>
        api.patch(
          '/startup/profile/confirm-update',
          toConfirmUpdateBody(localDraft as any, selectedChanges),
        );

      let res;
      try {
        res = isCreate ? await runCreate() : await runUpdate();
      } catch (first: any) {
        const code =
          first?.response?.data?.error?.code ||
          first?.response?.data?.detail?.code ||
          first?.response?.data?.code ||
          '';
        const msg = String(
          first?.response?.data?.message ||
            first?.response?.data?.detail?.message ||
            first?.response?.data?.detail ||
            first?.message ||
            '',
        );
        const needCreate =
          code === 'PROFILE_NOT_CONFIRMED' ||
          /confirm-create a profile first|PROFILE_NOT_CONFIRMED/i.test(msg);

        if (!isCreate && needCreate) {
          // Server has no official profile yet — create instead of update
          res = await runCreate();
          isCreate = true;
        } else if (
          isCreate &&
          (code === 'PROFILE_EXISTS' || /already exists|đã tồn tại/i.test(msg))
        ) {
          res = await runUpdate();
          isCreate = false;
        } else {
          throw first;
        }
      }

      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
          selectedChanges: [],
        });
        toast.success(
          isCreate
            ? tx(
                'Đã tạo hồ sơ chính thức thành công!',
                'Official startup profile created!',
              )
            : tx(
                'Đã cập nhật phiên bản hồ sơ mới!',
                'New profile version saved!',
              ),
        );
        setShowComparison(false);
        loadVersions();
      } else {
        throw new Error(
          res.data?.message ||
            tx('Máy chủ không xác nhận lưu hồ sơ.', 'Server did not confirm the save.'),
        );
      }
    } catch (e: any) {
      console.error('Failed to commit profile', e);
      const code =
        e?.response?.data?.error?.code ||
        e?.response?.data?.detail?.code ||
        '';
      const raw =
        e?.response?.data?.message ||
        e?.response?.data?.detail?.message ||
        (typeof e?.response?.data?.detail === 'string'
          ? e.response.data.detail
          : null) ||
        e?.message ||
        '';
      const friendly =
        code === 'PROFILE_NOT_CONFIRMED' ||
        /PROFILE_NOT_CONFIRMED|confirm-create/i.test(String(raw))
          ? tx(
              'Chưa có hồ sơ chính thức trên máy chủ. Hệ thống sẽ tạo mới — hãy bấm lại «Xác nhận & lưu hồ sơ».',
              'No official profile on the server yet. The app will create one — tap Confirm & save again.',
            )
          : String(raw) ||
            tx('Không lưu được hồ sơ.', 'Could not save the profile.');
      toast.error(friendly);
    } finally {
      setIsSaving(false);
      toast.dismiss(toastId);
    }
  };

  // History Version restore trigger
  const handleTriggerRestore = async (versionId: string) => {
    const toastId = toast.loading(tx('Đang so sánh sự khác biệt của phiên bản khôi phục...', 'Comparing differences with the restored version…'));
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
    const toastId = toast.loading(tx('Đang tiến hành khôi phục...', 'Restoring…'));
    try {
      const res = await api.post(`/startup/profile/versions/${versionId}/confirm-restore`);
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        setRestorePreview(null);
        toast.success(tx('Đã khôi phục về phiên bản cũ thành công!', 'Restored to the previous version!'));
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

    const toastId = toast.loading(tx('Đang ghi nhận lựa chọn...', 'Saving your choice…'));
    try {
      const res = await api.patch(
        '/startup/profile/confirm-update',
        toConfirmUpdateBody(updatedProfile as any, null),
      );
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
        });
        toast.success(tx(`Đã xử lý xung đột trường ${fieldLabel(fieldKey, lang)}!`, `Resolved conflict for ${fieldLabel(fieldKey, lang)}!`));
      }
    } catch (e) {
      console.error(e);
      toast.error(tx('Lỗi khi lưu lựa chọn.', 'Failed to save your choice.'));
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

    const toastId = toast.loading(tx('Đang xác nhận trường...', 'Confirming field…'));
    try {
      const res = await api.patch(
        '/startup/profile/confirm-update',
        toConfirmUpdateBody(updatedProfile as any, null),
      );
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
        });
        toast.success(tx('Đã xác nhận trường mở rộng thành công!', 'Extended field confirmed!'));
      }
    } catch (e) {
      console.error(e);
      toast.error(tx('Lỗi khi xác nhận trường.', 'Failed to confirm the field.'));
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

    const toastId = toast.loading(tx('Đang xóa trường...', 'Deleting field…'));
    try {
      const res = await api.patch(
        '/startup/profile/confirm-update',
        toConfirmUpdateBody(updatedProfile as any, null),
      );
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
        });
        toast.success(tx('Đã xóa trường mở rộng thành công!', 'Extended field deleted!'));
      }
    } catch (e) {
      console.error(e);
      toast.error(tx('Lỗi khi xóa trường.', 'Failed to delete the field.'));
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

    const toastId = toast.loading(tx('Đang cập nhật thay đổi...', 'Updating…'));
    try {
      const res = await api.patch(
        '/startup/profile/confirm-update',
        toConfirmUpdateBody(updatedProfile as any, null),
      );
      if (res.data && res.data.success) {
        setConfirmedProfile(res.data.data);
        useStartupStore.setState({
          localDraft: JSON.parse(JSON.stringify(res.data.data)),
          isDirty: false,
        });
        toast.success(tx('Đã cập nhật trường mở rộng thành công!', 'Extended field updated!'));
        setEditingCustomField(null);
      }
    } catch (e) {
      console.error(e);
      toast.error(tx('Lỗi khi cập nhật trường.', 'Failed to update the field.'));
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
    return cn(
      'mt-1.5 flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
      isHighlighted && 'border-primary bg-primary/5 ring-2 ring-primary/20',
    );
  };

  const renderFieldBadge = (fieldName: string) => {
    if (highlightedFields.includes(fieldName)) {
      return (
        <Badge
          variant="outline"
          className="ml-1.5 border-primary/30 bg-primary/10 text-[10px] text-primary"
        >
          <Sparkles className="size-2.5 animate-pulse" /> AI
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      <PortalHero
        eyebrow={t.setup.title}
        title={t.setup.title}
        description={t.setup.lead}
      />

      {/* Flow strip — upload-first, giống trang Apply */}
      <ol className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
        {[
          tx('1. Tải tài liệu / ảnh', '1. Upload doc / image'),
          tx('2. AI trích xuất & điền form', '2. AI extracts & fills the form'),
          tx('3. Bạn kiểm tra & chỉnh sửa', '3. You re-check & edit'),
          tx('4. Xác nhận & lưu hồ sơ', '4. Confirm & save'),
        ].map((label, i) => (
          <li key={label} className="inline-flex items-center gap-2">
            {i > 0 ? <span className="opacity-40">→</span> : null}
            <span className="rounded-full border border-border px-2.5 py-1">{label}</span>
          </li>
        ))}
      </ol>

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

      <Dialog open={!!restorePreview} onOpenChange={(o) => !o && setRestorePreview(null)}>
        <DialogContent className="sm:max-w-3xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>{tx('So sánh khôi phục phiên bản', 'Compare version restore')}</DialogTitle>
            <DialogDescription>
              {tx('Xem diff trước khi ghi đè hồ sơ chính thức.', 'Review the diff before overwriting the official profile.')}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-3">{tx('Trường', 'Field')}</TableHead>
                  <TableHead>{tx('Hiện tại', 'Current')}</TableHead>
                  <TableHead className="bg-amber-500/10 text-amber-800 dark:text-amber-300">
                    {tx('Khôi phục', 'Restore')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(restorePreview?.differences || []).map((d: any) => (
                  <TableRow key={d.field}>
                    <TableCell className="pl-3 font-medium whitespace-normal">
                      {fieldLabel(d.field, lang)}
                    </TableCell>
                    <TableCell className="max-w-[180px] whitespace-normal text-muted-foreground line-through">
                      {String(d.currentValue || tx('Chưa có', '—'))}
                    </TableCell>
                    <TableCell className="max-w-[180px] whitespace-normal bg-amber-500/5 font-medium">
                      {String(d.proposedValue || tx('Chưa có', '—'))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestorePreview(null)}>
              {tx('Hủy', 'Cancel')}
            </Button>
            <Button
              variant="default"
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => handleConfirmRestore(versions[0]?.id)}
            >
              {tx('Xác nhận khôi phục', 'Confirm restore')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab((v as any) || 'direct')}
        className="w-full"
      >
        <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1 sm:w-auto">
          <TabsTrigger value="doc" className="rounded-lg px-3 py-2">
            {t.setup.tabDoc}
            <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
              {tx('Khuyên dùng', 'Recommended')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="ocr" className="rounded-lg px-3 py-2">
            {t.setup.tabOcr}
          </TabsTrigger>
          <TabsTrigger value="direct" className="rounded-lg px-3 py-2">
            {t.setup.tabDirect}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg px-3 py-2">
            <History className="size-3.5" />
            {t.setup.tabHistory}
          </TabsTrigger>
        </TabsList>

      {/* 1. DIRECT FORM WIZARD */}
      <TabsContent value="direct" className="outline-none">
      {activeTab === 'direct' && !showComparison && localDraft && (
        <Card className="shadow-none">
        <CardContent className="space-y-6 pt-6">
          {/* Conflict Resolution Banner */}
          {localDraft.conflictingFields && localDraft.conflictingFields.filter((c: any) => c.status === 'pending_review').length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4 shadow-sm mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 animate-bounce" />
                <h4 className="font-bold text-amber-900 text-sm">{tx('Phát hiện xung đột dữ liệu từ AI', 'AI detected data conflicts')}</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {tx('AI đã trích xuất được thông tin mới khác biệt so với hồ sơ hiện tại. Vui lòng chọn giá trị chính xác để cập nhật:', 'AI extracted new values that differ from your current profile. Choose the correct value to keep:')}
              </p>
              
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {localDraft.conflictingFields.filter((c: any) => c.status === 'pending_review').map((c: any) => {
                  const fieldLabel = FIELD_LABELS[c.field] || c.field.replace('traction.', 'Traction: ');
                  return (
                    <div key={c.field} className="bg-card border border-border rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-sm">
                      <div className="min-w-[120px]">
                        <span className="font-bold text-foreground">{fieldLabel}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveConflict(c.field, 'current')}
                          className="px-3 py-1.5 bg-background hover:bg-muted text-foreground rounded-lg border border-border text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          {tx('Giữ cũ:', 'Keep current:')} <span className="text-muted-foreground italic font-normal">{Array.isArray(c.currentValue) ? c.currentValue.join(', ') : String(c.currentValue || tx('Trống', 'Empty'))}</span>
                        </button>
                        <span className="text-muted-foreground font-medium">{tx('hoặc', 'or')}</span>
                        <button
                          type="button"
                          onClick={() => handleResolveConflict(c.field, 'proposed')}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary rounded-lg border border-primary/30 text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                        >
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span>{tx('Dùng mới:', 'Use new:')} {Array.isArray(c.proposedValue) ? c.proposedValue.join(', ') : String(c.proposedValue || tx('Trống', 'Empty'))}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step Badges Progress */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="text-sm font-bold text-muted-foreground">{tx('Bước', 'Step')} {formStep} / 5: {
              formStep === 1 ? tx('Thông tin cơ bản', 'Basic info') :
              formStep === 2 ? tx('Sản phẩm & Giải pháp', 'Product & Solution') :
              formStep === 3 ? tx('Chỉ số & Traction', 'Metrics & Traction') :
              formStep === 4 ? tx('Đội ngũ sáng lập', 'Founding team') :
              tx('Nhu cầu vốn & Hợp tác', 'Funding & Partnership needs')
            }</span>

            <div className="flex space-x-1.5">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`h-2.5 w-8 rounded-full ${
                    formStep === step ? 'bg-primary' : formStep > step ? 'bg-primary/40' : 'bg-muted'
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
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Tên Startup *', 'Startup name *')}
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
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Địa chỉ Website (URL)', 'Website (URL)')}
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
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Năm thành lập', 'Founding year')}
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
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Địa chỉ trụ sở', 'Head-office address')}
                    {renderFieldBadge('address')}
                  </label>
                  <input
                    type="text"
                    value={localDraft.address || ''}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    className={getFieldClassName('address')}
                    placeholder={tx('Q1, TP. Hồ Chí Minh', 'District 1, Ho Chi Minh City')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Quốc gia hoạt động', 'Country of operation')}
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
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Email liên hệ công việc *', 'Business contact email *')}
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
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Mô tả ngắn về mô hình Startup', 'Short description of the startup')}
                    {renderFieldBadge('description')}
                  </label>
                  <textarea
                    rows={2}
                    value={localDraft.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    className={getFieldClassName('description')}
                    placeholder={tx('Nhập 1 câu mô tả ngắn về startup...', 'One short sentence describing your startup…')}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-foreground">
                      {tx('Vấn đề đang giải quyết', 'Problem you are solving')}
                      {renderFieldBadge('problemStatement')}
                    </label>
                    <textarea
                      rows={3}
                      value={localDraft.problemStatement || ''}
                      onChange={(e) => handleFieldChange('problemStatement', e.target.value)}
                      className={getFieldClassName('problemStatement')}
                      placeholder={tx('Nêu ra vấn đề thực tế nhức nhối...', 'Describe the painful real-world problem…')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground">
                      {tx('Giải pháp của bạn', 'Your solution')}
                      {renderFieldBadge('solutionDescription')}
                    </label>
                    <textarea
                      rows={3}
                      value={localDraft.solutionDescription || ''}
                      onChange={(e) => handleFieldChange('solutionDescription', e.target.value)}
                      className={getFieldClassName('solutionDescription')}
                      placeholder={tx('Giải pháp công nghệ hay kinh doanh xử lý vấn đề trên...', 'The tech or business solution that solves it…')}
                    />
                  </div>
                </div>

                {/* Industries selection tags */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {tx('Lĩnh vực hoạt động (Chọn nhiều)', 'Industries (multi-select)')}
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
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-card border-border text-muted-foreground hover:border-border'
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
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {tx('Công nghệ cốt lõi (Chọn nhiều)', 'Core technologies (multi-select)')}
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
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-card border-border text-muted-foreground hover:border-border'
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
                    <label className="block text-sm font-semibold text-foreground">
                      {tx('Số lượng khách hàng (Doanh nghiệp/B2B)', 'Customers (B2B)')}
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
                    <label className="block text-sm font-semibold text-foreground">
                      {tx('Số lượng người dùng active (B2C)', 'Active users (B2C)')}
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
                    <label className="block text-sm font-semibold text-foreground">
                      {tx('Doanh thu trung bình hàng tháng (MRR)', 'Monthly recurring revenue (MRR)')}
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
                    <label className="block text-sm font-semibold text-foreground">
                      {tx('Tốc độ tăng trưởng hàng năm (%)', 'Annual growth rate (%)')}
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
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Thành tựu nổi bật đạt được', 'Key achievements')}
                    {renderFieldBadge('tractionAchievements')}
                  </label>
                  <textarea
                    rows={6}
                    value={
                      Array.isArray(localDraft.traction?.achievements)
                        ? localDraft.traction.achievements.join('\n')
                        : ''
                    }
                    onChange={(e) => {
                      // Keep empty lines while typing so multi-line entry works;
                      // trim blanks only on blur/save.
                      handleTractionChange('achievements', e.target.value.split('\n'))
                    }}
                    onBlur={(e) => {
                      handleTractionChange(
                        'achievements',
                        e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }}
                    className={`${getFieldClassName('tractionAchievements')} min-h-[140px] resize-y`}
                    placeholder={tx(
                      'Mỗi thành tựu 1 dòng:\n- Top 10 Techfest Vietnam\n- Nhận gói tài trợ AWS 10k USD\n- 50k MAU Q1/2026',
                      'One achievement per line:\n- Top 10 Techfest Vietnam\n- AWS 10k USD grant\n- 50k MAU Q1/2026',
                    )}
                  />
                </div>
              </div>
            )}

            {/* STEP 4: TEAM MEMBERS — shadcn data table */}
            {formStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold">{tx('Đội ngũ sáng lập', 'Founding team')}</h4>
                    <p className="text-xs text-muted-foreground">
                      {(localDraft.teamMembers || []).length} {tx('thành viên', 'members')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={handleAddTeamMember}
                  >
                    <Plus className="size-3.5" />
                    {tx('Thêm', 'Add')}
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-3">{tx('Họ tên', 'Full name')}</TableHead>
                        <TableHead>{tx('Chức vụ', 'Role')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{tx('Kinh nghiệm', 'Experience')}</TableHead>
                        <TableHead className="w-[1%] pr-3" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(localDraft.teamMembers || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                            {tx('Chưa có thành viên — bấm Thêm.', 'No members yet — click Add.')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        (localDraft.teamMembers || []).map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="pl-3 whitespace-normal">
                              <Input
                                value={member.fullName}
                                onChange={(e) =>
                                  handleUpdateTeamMember(member.id!, 'fullName', e.target.value)
                                }
                                placeholder="Nguyễn Văn B"
                                className="h-8 min-w-[120px]"
                              />
                            </TableCell>
                            <TableCell className="whitespace-normal">
                              <Input
                                value={member.position}
                                onChange={(e) =>
                                  handleUpdateTeamMember(member.id!, 'position', e.target.value)
                                }
                                placeholder="Co-founder & CTO"
                                className="h-8 min-w-[120px]"
                              />
                            </TableCell>
                            <TableCell className="hidden whitespace-normal sm:table-cell">
                              <Input
                                value={member.experience}
                                onChange={(e) =>
                                  handleUpdateTeamMember(member.id!, 'experience', e.target.value)
                                }
                                placeholder={tx('5 năm ML…', '5 yrs ML…')}
                                className="h-8 min-w-[160px]"
                              />
                            </TableCell>
                            <TableCell className="pr-3 text-right">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveTeamMember(member.id!)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* STEP 5: FUNDING & PARTNERSHIP */}
            {formStep === 5 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-foreground">
                      {tx('Số vốn mong muốn gọi (Funding Need)', 'Funding need')}
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
                    <label className="block text-sm font-semibold text-foreground">{tx('Đơn vị tiền tệ', 'Currency')}</label>
                    <select
                      value={localDraft.currency}
                      onChange={(e) => handleFieldChange('currency', e.target.value)}
                      className="mt-1.5 block w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="VND">VND (đ)</option>
                    </select>
                  </div>
                </div>

                {/* Markets Selection */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {tx('Thị trường mở rộng mong muốn (Markets)', 'Target expansion markets')}
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
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-card border-border text-muted-foreground hover:border-border'
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
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {tx('Hình thức hợp tác tìm kiếm (Chọn nhiều)', 'Partnership types sought (multi-select)')}
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
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-card border-border text-muted-foreground hover:border-border'
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
                  <label className="block text-sm font-semibold text-foreground">
                    {tx('Giai đoạn phát triển hiện tại', 'Current development stage')}
                    {renderFieldBadge('stage')}
                  </label>
                  <select
                    value={localDraft.stage}
                    onChange={(e) => handleFieldChange('stage', e.target.value)}
                    className="mt-1.5 block w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">{tx('Chọn giai đoạn...', 'Select a stage…')}</option>
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

          <div className="flex items-center justify-between border-t border-border pt-6">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={formStep === 1}
              onClick={() => setFormStep(formStep - 1)}
            >
              <ChevronLeft className="size-4" />
              {tx('Quay lại', 'Back')}
            </Button>

            {formStep < 5 ? (
              <Button
                type="button"
                className="rounded-full"
                onClick={() => setFormStep(formStep + 1)}
              >
                {tx('Tiếp tục', 'Continue')}
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-full"
                disabled={!agreeTerms}
                onClick={() => {
                  setSelectedChanges([])
                  setShowComparison(true)
                }}
              >
                <CheckCircle className="size-4" />
                {tx('So sánh & xác nhận', 'Compare & confirm')}
              </Button>
            )}
          </div>

          {formStep === 5 && (
            <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <span>
                <strong>
                  {tx(
                    'Tôi đồng ý Điều khoản & Chính sách bảo mật *',
                    'I agree to the Terms & Privacy Policy *',
                  )}
                </strong>
                <span className="mt-0.5 block text-muted-foreground">
                  {tx(
                    'Cho phép hệ thống lưu trữ, phân tích hồ sơ và tài liệu tải lên để phục vụ so khớp, chấm điểm và kết nối với đối tác. Xem ',
                    'Allow the platform to store and analyze your profile and uploaded documents for matching, scoring and partner connections. See ',
                  )}
                  <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                    {tx('Điều khoản', 'Terms')}
                  </a>
                  {' · '}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                    {tx('Chính sách bảo mật', 'Privacy Policy')}
                  </a>
                  .
                </span>
              </span>
            </label>
          )}

          {/* Custom/Extended Fields Section */}
          {localDraft.customFields && localDraft.customFields.length > 0 && (
            <div className="bg-background border border-border rounded-xl p-6 space-y-4 mt-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center space-x-2">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  <h4 className="font-bold text-foreground text-sm">{tx('Thông tin mở rộng (AI phát hiện)', 'Extended fields (AI-detected)')}</h4>
                </div>
                <span className="text-[11px] bg-muted text-foreground px-2 py-0.5 rounded-full font-bold">
                  {localDraft.customFields.length} {tx('trường', 'fields')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tx('Các thông tin sau đây được AI trích xuất từ tài liệu của bạn nhưng không nằm trong các trường form chuẩn. Bạn có thể duyệt, sửa hoặc xóa chúng:', 'These fields were AI-extracted from your document but are outside the standard form. Review, edit, or delete them:')}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localDraft.customFields.map((cf: any) => {
                  const isNew = newCustomFields.includes(cf.key);
                  return (
                    <div 
                      key={cf.key} 
                      className={`bg-card border rounded-xl p-4 space-y-3 shadow-sm transition-all relative overflow-hidden ${
                        cf.requiresConfirmation 
                          ? 'border-amber-300 bg-amber-50/5' 
                          : isNew
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border hover:border-border'
                      }`}
                    >
                      {/* Top header row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            {cf.category || tx('Thông tin thêm', 'Additional info')}
                          </span>
                          <h5 className="font-bold text-foreground text-sm mt-0.5">{cf.label}</h5>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          {cf.requiresConfirmation && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold flex items-center mr-1">
                              <AlertCircle className="h-3 w-3 mr-0.5" /> {tx('Chờ duyệt', 'Pending review')}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditCustomField(cf)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title={tx('Chỉnh sửa', 'Edit')}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomField(cf.key)}
                            className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600 transition-colors cursor-pointer"
                            title={tx('Xóa trường', 'Delete field')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Value content */}
                      <div className="bg-background rounded-lg p-2.5 border border-border">
                        {Array.isArray(cf.value) ? (
                          <div className="flex flex-wrap gap-1.5">
                            {cf.value.map((v: any, idx: number) => (
                              <span key={idx} className="bg-card border border-border px-2 py-0.5 rounded text-xs text-foreground font-medium">
                                {String(v)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                            {String(cf.value)}
                          </span>
                        )}
                      </div>

                      {/* Source attribution and actions */}
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-muted-foreground italic">
                          {tx('Độ tin cậy:', 'Confidence:')} {Math.round((cf.confidence || 0.9) * 100)}%
                        </span>
                        
                        {cf.requiresConfirmation && (
                          <button
                            type="button"
                            onClick={() => handleConfirmCustomField(cf.key)}
                            className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded text-[11px] font-bold shadow-sm transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{tx('Xác nhận', 'Confirm')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
        </Card>
      )}
      </TabsContent>

      {/* 2. IMAGE UPLOAD TAB */}
      <TabsContent value="ocr" className="outline-none">
      {activeTab === 'ocr' && (
        <div className="space-y-6">
          {ocrStatus === 'idle' && !extractionDraft && (
            <Card className="shadow-none">
            <CardContent className="space-y-6 py-10 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <UploadCloud className="size-8" />
              </div>

              <div className="mx-auto max-w-md space-y-2">
                <h3 className="font-heading text-base font-semibold">{tx('Tải ảnh chụp chỉ số hay bảng tóm tắt', 'Upload a metrics screenshot or summary')}</h3>
                <p className="text-sm text-muted-foreground leading-normal">
                  {tx('JPG, PNG, WEBP — AI OCR cấu trúc hóa chỉ số kinh doanh.', 'JPG, PNG, WEBP — AI OCR structures your business metrics.')}
                </p>
              </div>

              <div className="flex justify-center">
                <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90">
                  <ImageIcon className="size-4" />
                  <span>{tx('Chọn ảnh từ thiết bị', 'Choose an image')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </CardContent>
            </Card>
          )}

          {(ocrStatus === 'uploading' || ocrStatus === 'processing') && (
            <Card className="shadow-none">
            <CardContent className="space-y-6 py-8 text-center">
              {imagePreviewUrl && (
                <div className="max-w-xs mx-auto border border-border rounded-lg overflow-hidden shadow-sm relative animate-pulse">
                  <img src={imagePreviewUrl} alt="Preview" className="w-full h-auto object-cover opacity-60" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-card/10 backdrop-blur-[1px] flex items-center justify-center" />
                </div>
              )}
              
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-foreground">
                  {ocrStatus === 'uploading' ? tx('Đang tải hình ảnh lên...', 'Uploading image…') : tx('Đang phân tích hình ảnh bằng AI...', 'Analyzing image with AI…')}
                </p>
                <p className="text-xs text-muted-foreground">{tx('Quá trình này có thể mất vài giây. Vui lòng giữ nguyên màn hình.', 'This may take a few seconds. Please keep this screen open.')}</p>
              </div>

              <div className="mx-auto max-w-xl space-y-3 border-t border-border pt-4">
                <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
                <div className="h-10 w-5/6 animate-pulse rounded-lg bg-muted" />
                <div className="h-10 w-4/5 animate-pulse rounded-lg bg-muted" />
              </div>
            </CardContent>
            </Card>
          )}

          {ocrStatus === 'error' && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>{tx('Lỗi phân tích hình ảnh', 'Image analysis error')}</AlertTitle>
              <AlertDescription>
                {ocrError || tx('Đã xảy ra lỗi khi gửi hoặc phân tích ảnh.', 'Something went wrong sending or analyzing the image.')}
              </AlertDescription>
            </Alert>
          )}

          {extractionDraft && (ocrStatus === 'completed' || ocrStatus === 'idle') && (
            <div className="space-y-4">
              {imagePreviewUrl && (
                <Card size="sm" className="shadow-none">
                  <CardContent className="flex items-center gap-4 pt-4">
                    <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border">
                      <img src={imagePreviewUrl} alt="Preview" className="size-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold">{tx('Ảnh đang xem xét', 'Image under review')}</h4>
                      <p className="text-xs text-muted-foreground">{tx('Chọn ảnh khác để phân tích lại.', 'Pick another image to re-analyze.')}</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold">
                      <ImageIcon className="size-3.5" />
                      {tx('Thay đổi', 'Change')}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0" />
                    </label>
                  </CardContent>
                </Card>
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
      </TabsContent>

      <TabsContent value="doc" className="outline-none">
      {activeTab === 'doc' && (
        <div className="space-y-6">
          {!extractionDraft ? (
            <Card className="shadow-none">
              <CardContent className="space-y-6 py-10 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                  <UploadCloud className="size-8" />
                </div>
                <div className="mx-auto max-w-md space-y-2">
                  <h3 className="font-heading text-base font-semibold">{tx('Tải Pitch Deck / Kế hoạch KD', 'Upload pitch deck / business plan')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {tx('PDF, DOCX, PPTX — AI chuẩn hóa thành trường hồ sơ.', 'PDF, DOCX, PPTX — AI normalizes it into profile fields.')}
                  </p>
                </div>
                <div className="flex justify-center">
                  <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
                    <FileText className="size-4" />
                    {tx('Chọn tài liệu', 'Choose a document')}
                    <input
                      type="file"
                      accept=".pdf,.docx,.pptx"
                      onChange={handleDocUpload}
                      className="absolute inset-0 opacity-0"
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
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
      </TabsContent>

      <TabsContent value="history" className="outline-none">
      {activeTab === 'history' && (
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          <CardHeader className="border-b py-4!">
            <CardTitle>{tx('Lịch sử phiên bản', 'Version history')}</CardTitle>
            <CardDescription>
              {tx('Ghi nhận tự động mỗi lần xác nhận cập nhật hồ sơ.', 'Recorded automatically every time you confirm an update.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {versions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">{tx('Phiên bản', 'Version')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{tx('Người xác nhận', 'Confirmed by')}</TableHead>
                    <TableHead className="hidden md:table-cell">{tx('Thời gian', 'Time')}</TableHead>
                    <TableHead>{tx('Tóm tắt', 'Summary')}</TableHead>
                    <TableHead className="w-[1%] pr-4 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((ver) => (
                    <TableRow key={ver.id}>
                      <TableCell className="pl-4 font-medium tabular-nums">
                        #{ver.versionNumber}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {ver.confirmedBy}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {new Date(ver.createdAt).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="max-w-[240px] whitespace-normal text-xs text-muted-foreground">
                        {ver.changeSummary?.description || '—'}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => handleTriggerRestore(ver.id)}
                        >
                          {tx('Khôi phục', 'Restore')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-4 py-12 text-center text-sm italic text-muted-foreground">
                {tx('Chưa có phiên bản lịch sử.', 'No version history yet.')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      </TabsContent>
      </Tabs>

      <Dialog open={!!editingCustomField} onOpenChange={(o) => !o && setEditingCustomField(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{tx('Chỉnh sửa thông tin mở rộng', 'Edit extended field')}</DialogTitle>
            <DialogDescription>{tx('Cập nhật giá trị trích xuất AI.', 'Update the AI-extracted value.')}</DialogDescription>
          </DialogHeader>
          {editingCustomField && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>{tx('Tên trường', 'Field name')}</Label>
                <Input disabled value={editingCustomField.label} />
              </div>
              <div className="grid gap-2">
                <Label>{tx('Giá trị', 'Value')}</Label>
                {editingCustomField.type === 'list' ? (
                  <>
                    <Input
                      value={customFieldEditValue}
                      onChange={(e) => setCustomFieldEditValue(e.target.value)}
                      placeholder={tx('Giá trị 1, Giá trị 2,…', 'Value 1, Value 2,…')}
                    />
                    <p className="text-[11px] text-muted-foreground">{tx('Phân cách bằng dấu phẩy.', 'Separate with commas.')}</p>
                  </>
                ) : (
                  <Textarea
                    rows={4}
                    value={customFieldEditValue}
                    onChange={(e) => setCustomFieldEditValue(e.target.value)}
                    placeholder={tx('Nhập giá trị…', 'Enter a value…')}
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustomField(null)}>
              {tx('Hủy', 'Cancel')}
            </Button>
            <Button onClick={handleSaveCustomFieldEdit}>{tx('Lưu', 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
