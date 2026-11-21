import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Image as ImageIcon,
  Camera,
  X,
  MapPin,
  Video,
  ShieldAlert,
  Send,
  AlertCircle,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Chip } from '../../src/components/ui/Chip';
import { Skeleton } from '../../src/components/ui/Skeleton';
import {
  useEvent,
  useCreateEvent,
  useUpdateEvent,
} from '../../src/hooks/useEvents';
import { clubPhotoService } from '../../src/lib/clubs/clubPhotoService';
import { useAuthStore } from '../../src/store/authStore';
import {
  CommunityEvent,
  EventCategory,
  EventType,
  EventStatus,
} from '../../src/types/event';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

const EVENT_CATEGORIES: EventCategory[] = [
  'Webinar',
  'Vaccination Clinic',
  'Adoption Fair',
  'Breed Meetup',
  'Training Workshop',
];

interface EventFormProps {
  initialEvent?: CommunityEvent | null;
  eventId?: string;
  isEditing: boolean;
}

function EventForm({ initialEvent, eventId, isEditing }: EventFormProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const [title, setTitle] = useState(initialEvent?.title || '');
  const [description, setDescription] = useState(initialEvent?.description || '');
  const [category, setCategory] = useState<EventCategory>(
    initialEvent?.category || 'Webinar',
  );
  const [eventType, setEventType] = useState<EventType>(
    initialEvent?.event_type || 'virtual',
  );
  const [locationOrUrl, setLocationOrUrl] = useState(
    initialEvent?.location_or_url || '',
  );
  const [organizerName, setOrganizerName] = useState(
    initialEvent?.organizer_name || user?.fullName || 'Dr. Veterinarian',
  );
  const [status, setStatus] = useState<EventStatus>(
    initialEvent?.status || 'published',
  );
  const [imageUri, setImageUri] = useState<string | null>(
    initialEvent?.cover_image || null,
  );

  // Compute initial dates
  const getInitialDates = () => {
    if (initialEvent) {
      try {
        const start = new Date(initialEvent.start_time);
        const end = new Date(initialEvent.end_time);
        return {
          startDate: start.toISOString().split('T')[0],
          startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
          endDate: end.toISOString().split('T')[0],
          endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
        };
      } catch {
        // fallback
      }
    }
    return {
      startDate: '2026-10-25',
      startTime: '14:00',
      endDate: '2026-10-25',
      endTime: '15:30',
    };
  };

  const initialDates = getInitialDates();
  const [startDateStr, setStartDateStr] = useState(initialDates.startDate);
  const [startTimeStr, setStartTimeStr] = useState(initialDates.startTime);
  const [endDateStr, setEndDateStr] = useState(initialDates.endDate);
  const [endTimeStr, setEndTimeStr] = useState(initialDates.endTime);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useCreateEvent();
  const updateMutation = useUpdateEvent();

  const handlePickLibrary = async () => {
    setErrorMsg(null);
    const result = await clubPhotoService.pickFromLibrary();
    if (!result.canceled && result.uri) {
      setImageUri(result.uri);
    } else if (result.error) {
      setErrorMsg(result.error);
    }
  };

  const handleTakePhoto = async () => {
    setErrorMsg(null);
    const result = await clubPhotoService.takePhoto();
    if (!result.canceled && result.uri) {
      setImageUri(result.uri);
    } else if (result.error) {
      setErrorMsg(result.error);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const applyPreset = (daysInFuture: number, startHour: number, durationHours: number) => {
    const start = new Date(Date.now() + 86400000 * daysInFuture);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000 * durationHours);
    setStartDateStr(start.toISOString().split('T')[0]);
    setStartTimeStr(
      `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    );
    setEndDateStr(end.toISOString().split('T')[0]);
    setEndTimeStr(
      `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
    );
  };

  const parseDateTime = (dateStr: string, timeStr: string): Date | null => {
    try {
      const parts = dateStr.trim().split('-');
      if (parts.length !== 3) return null;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      const timeParts = timeStr.trim().split(':');
      const hours = parseInt(timeParts[0] || '0', 10);
      const minutes = parseInt(timeParts[1] || '0', 10);

      const d = new Date(year, month, day, hours, minutes, 0, 0);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || title.trim().length < 3 || title.trim().length > 150) {
      setErrorMsg('Event title must be between 3 and 150 characters.');
      return;
    }

    if (!description.trim() || description.trim().length < 20) {
      setErrorMsg('Event description must contain at least 20 characters.');
      return;
    }

    if (!locationOrUrl.trim()) {
      setErrorMsg(
        eventType === 'virtual'
          ? 'Please provide a virtual meeting link (e.g. Zoom or Meet URL).'
          : 'Please provide a physical venue address.',
      );
      return;
    }

    const start = parseDateTime(startDateStr, startTimeStr);
    const end = parseDateTime(endDateStr, endTimeStr);

    if (!start || !end) {
      setErrorMsg('Please enter valid dates and times (format: YYYY-MM-DD and HH:MM).');
      return;
    }

    if (end.getTime() <= start.getTime()) {
      setErrorMsg('Event end time must be after the start time.');
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to organize community events.');
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);

    try {
      let finalCoverImage = imageUri;

      if (
        imageUri &&
        (imageUri.startsWith('file:') ||
          imageUri.startsWith('content:') ||
          imageUri.startsWith('blob:') ||
          imageUri.startsWith('ph:'))
      ) {
        finalCoverImage = await clubPhotoService.uploadPostImage(
          imageUri,
          user.id,
          (pct) => setUploadPercent(pct),
        );
      }

      if (isEditing && eventId) {
        await updateMutation.mutateAsync({
          eventId,
          input: {
            title: title.trim(),
            description: description.trim(),
            category,
            event_type: eventType,
            location_or_url: locationOrUrl.trim(),
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            organizer_name: organizerName.trim() || 'Veterinarian',
            cover_image: finalCoverImage,
            status,
          },
        });

        Alert.alert('Event Updated', 'Your event changes have been saved.', [
          {
            text: 'View Event',
            onPress: () => router.replace(`/events/${eventId}` as any),
          },
        ]);
      } else {
        const created = await createMutation.mutateAsync({
          title: title.trim(),
          description: description.trim(),
          category,
          event_type: eventType,
          location_or_url: locationOrUrl.trim(),
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          organizer_name: organizerName.trim() || 'Veterinarian',
          cover_image: finalCoverImage,
          status,
        });

        Alert.alert(
          status === 'published' ? 'Event Published!' : 'Draft Saved',
          status === 'published'
            ? 'Your community event is now live and visible to pet parents.'
            : 'Your draft has been saved securely.',
          [
            {
              text: 'View Event',
              onPress: () => router.replace(`/events/${created.id}` as any),
            },
          ],
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save event. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadPercent(0);
    }
  };

  const isSubmitting = isUploading || createMutation.isPending || updateMutation.isPending;

  return (
    <Screen scrollable testID="create-edit-event-screen">
      {/* Top Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="btn-back"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Heading level={2}>
          {isEditing ? 'Edit Event' : 'Create Community Event'}
        </Heading>
        <View style={{ width: 40 }} />
      </View>

      {/* Error Banner */}
      {errorMsg ? (
        <View style={styles.errorBanner} testID="event-error-banner">
          <AlertCircle size={18} color={colors.destructive} />
          <Text variant="bodySm" color={colors.destructive} style={{ flex: 1, marginLeft: 8 }}>
            {errorMsg}
          </Text>
        </View>
      ) : null}

      {/* Basic Info Section */}
      <Card style={styles.formSection}>
        <Heading level={3} style={styles.sectionHeading}>
          Event Overview
        </Heading>

        <Input
          label="Event Title *"
          placeholder="e.g. Senior Dog Nutrition & Mobility Webinar"
          value={title}
          onChangeText={setTitle}
          maxLength={150}
          testID="input-event-title"
        />

        <Text variant="caption" color={colors.inkSoft} style={{ marginBottom: spacing.xs }}>
          Category *
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {EVENT_CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={category === cat}
              onPress={() => setCategory(cat)}
              testID={`chip-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            />
          ))}
        </ScrollView>

        <Text variant="caption" color={colors.inkSoft} style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>
          Format *
        </Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[
              styles.formatOption,
              eventType === 'virtual' && styles.formatOptionSelected,
            ]}
            onPress={() => setEventType('virtual')}
            accessibilityRole="radio"
            accessibilityState={{ selected: eventType === 'virtual' }}
            testID="option-format-virtual"
          >
            <Video
              size={18}
              color={eventType === 'virtual' ? colors.primary : colors.inkSoft}
            />
            <Text
              variant="bodySm"
              style={[
                styles.formatOptionText,
                eventType === 'virtual' && styles.formatOptionTextSelected,
              ]}
            >
              Virtual / Online
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.formatOption,
              eventType === 'in_person' && styles.formatOptionSelected,
            ]}
            onPress={() => setEventType('in_person')}
            accessibilityRole="radio"
            accessibilityState={{ selected: eventType === 'in_person' }}
            testID="option-format-in-person"
          >
            <MapPin
              size={18}
              color={eventType === 'in_person' ? colors.primary : colors.inkSoft}
            />
            <Text
              variant="bodySm"
              style={[
                styles.formatOptionText,
                eventType === 'in_person' && styles.formatOptionTextSelected,
              ]}
            >
              In-Person
            </Text>
          </TouchableOpacity>
        </View>

        <Input
          label={
            eventType === 'virtual'
              ? 'Meeting Link or Room URL *'
              : 'Physical Venue / Address *'
          }
          placeholder={
            eventType === 'virtual'
              ? 'https://meet.vetopia.com/session-id'
              : 'Vetopia Health Pavilion, 1200 Greenway Blvd'
          }
          value={locationOrUrl}
          onChangeText={setLocationOrUrl}
          testID="input-event-location-url"
        />

        <Input
          label="Organizer Name / Credentials *"
          placeholder="e.g. Dr. Jane Smith, DVM"
          value={organizerName}
          onChangeText={setOrganizerName}
          testID="input-organizer-name"
        />
      </Card>

      {/* Schedule & Timing Section */}
      <Card style={styles.formSection}>
        <Heading level={3} style={styles.sectionHeading}>
          Date & Time Schedule
        </Heading>

        <Text variant="caption" color={colors.inkSoft} style={{ marginBottom: spacing.xs }}>
          Quick Schedule Presets
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsScroll}
        >
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => applyPreset(1, 14, 1.5)}
            testID="btn-preset-tomorrow"
          >
            <Text variant="caption" color={colors.primary}>Tomorrow 2:00 PM</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => applyPreset(3, 10, 2)}
            testID="btn-preset-in-3-days"
          >
            <Text variant="caption" color={colors.primary}>In 3 Days 10:00 AM</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => applyPreset(7, 18, 1)}
            testID="btn-preset-next-week"
          >
            <Text variant="caption" color={colors.primary}>Next Week 6:00 PM</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.dateTimeGrid}>
          <View style={styles.dateTimeColumn}>
            <Input
              label="Start Date (YYYY-MM-DD)"
              value={startDateStr}
              onChangeText={setStartDateStr}
              placeholder="2026-10-25"
              testID="input-start-date"
            />
          </View>
          <View style={styles.dateTimeColumn}>
            <Input
              label="Start Time (HH:MM)"
              value={startTimeStr}
              onChangeText={setStartTimeStr}
              placeholder="14:00"
              testID="input-start-time"
            />
          </View>
        </View>

        <View style={styles.dateTimeGrid}>
          <View style={styles.dateTimeColumn}>
            <Input
              label="End Date (YYYY-MM-DD)"
              value={endDateStr}
              onChangeText={setEndDateStr}
              placeholder="2026-10-25"
              testID="input-end-date"
            />
          </View>
          <View style={styles.dateTimeColumn}>
            <Input
              label="End Time (HH:MM)"
              value={endTimeStr}
              onChangeText={setEndTimeStr}
              placeholder="15:30"
              testID="input-end-time"
            />
          </View>
        </View>
      </Card>

      {/* Description Section */}
      <Card style={styles.formSection}>
        <Heading level={3} style={styles.sectionHeading}>
          Event Description
        </Heading>

        <Input
          label="Detailed Description *"
          placeholder="Provide an overview of topics covered, target audience, what attendees should bring, and participation guidelines..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          style={{ height: 120, textAlignVertical: 'top' }}
          testID="input-event-description"
        />
        <Text variant="caption" color={colors.inkSoft}>
          {description.length} characters (minimum 20)
        </Text>
      </Card>

      {/* Cover Image Section */}
      <Card style={styles.formSection}>
        <Heading level={3} style={styles.sectionHeading}>
          Event Promotional Image
        </Heading>

        {imageUri ? (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={handleRemoveImage}
              style={styles.removeImageBtn}
              accessibilityLabel="Remove image"
              accessibilityRole="button"
              testID="btn-remove-image"
            >
              <X size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoActionsRow}>
            <Button
              title="Pick Photo"
              variant="outline"
              size="sm"
              leftIcon={<ImageIcon size={16} color={colors.primary} />}
              onPress={handlePickLibrary}
              testID="btn-pick-photo"
            />
            <Button
              title="Take Photo"
              variant="outline"
              size="sm"
              leftIcon={<Camera size={16} color={colors.primary} />}
              onPress={handleTakePhoto}
              testID="btn-take-photo"
            />
          </View>
        )}
      </Card>

      {/* Publication Status Section */}
      <Card style={styles.formSection}>
        <Heading level={3} style={styles.sectionHeading}>
          Visibility
        </Heading>

        <View style={styles.statusOptions}>
          <TouchableOpacity
            style={[
              styles.statusOption,
              status === 'published' && styles.statusOptionSelected,
            ]}
            onPress={() => setStatus('published')}
            accessibilityRole="radio"
            accessibilityState={{ selected: status === 'published' }}
            testID="option-status-published"
          >
            <Text
              variant="bodySm"
              style={[
                styles.statusOptionText,
                status === 'published' && styles.statusOptionTextSelected,
              ]}
            >
              Publish Immediately (Public)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusOption,
              status === 'draft' && styles.statusOptionSelected,
            ]}
            onPress={() => setStatus('draft')}
            accessibilityRole="radio"
            accessibilityState={{ selected: status === 'draft' }}
            testID="option-status-draft"
          >
            <Text
              variant="bodySm"
              style={[
                styles.statusOptionText,
                status === 'draft' && styles.statusOptionTextSelected,
              ]}
            >
              Save as Draft (Private)
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Submit Button */}
      <View style={styles.submitSection}>
        <Button
          title={
            isUploading
              ? `Uploading Photo (${uploadPercent}%)...`
              : isSubmitting
              ? 'Saving Event...'
              : isEditing
              ? 'Update Event'
              : status === 'published'
              ? 'Publish Event'
              : 'Save Draft'
          }
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          leftIcon={<Send size={18} color={colors.ink} />}
          testID="btn-submit-event"
        />
      </View>

      <View style={{ height: spacing['2xl'] }} />
    </Screen>
  );
}

export default function CreateEditEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const router = useRouter();
  const { user, role } = useAuthStore();

  const isEditing = Boolean(eventId);
  const { data: existingEvent, isLoading: eventLoading } = useEvent(eventId || '');

  const canAuthor =
    role === 'admin' ||
    user?.isVet === true ||
    user?.isVetVerified === true ||
    user?.roles?.includes('admin') ||
    user?.roles?.includes('vet');

  if (!canAuthor) {
    return (
      <Screen scrollable testID="events-unauthorized-screen">
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Heading level={3}>Community Events</Heading>
        </View>

        <Card style={styles.permissionCard}>
          <ShieldAlert size={48} color={colors.primary} style={{ alignSelf: 'center' }} />
          <Heading level={2} style={styles.permissionHeading}>
            Verified Veterinarian Access
          </Heading>
          <Text variant="bodyMd" color={colors.inkSoft} style={styles.permissionText}>
            To maintain medical accuracy, community trust, and safety standards, only verified
            veterinarians and community administrators may organize events.
          </Text>
          <Button
            title="Go Back"
            variant="outline"
            onPress={() => router.back()}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </Screen>
    );
  }

  if (isEditing && eventLoading) {
    return (
      <Screen scrollable testID="event-create-loading">
        <View style={styles.topNav}>
          <Skeleton width={140} height={28} />
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <Skeleton width="100%" height={160} style={{ borderRadius: radii.md }} />
          <Skeleton width="100%" height={220} style={{ borderRadius: radii.md }} />
        </View>
      </Screen>
    );
  }

  return (
    <EventForm
      key={existingEvent?.id || 'new-event'}
      initialEvent={existingEvent}
      eventId={eventId}
      isEditing={isEditing}
    />
  );
}

const styles = StyleSheet.create({
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCard: {
    padding: spacing.lg,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  permissionHeading: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  formSection: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionHeading: {
    marginBottom: spacing.sm,
  },
  categoryScroll: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  formatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formatOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  formatOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  formatOptionText: {
    color: colors.inkSoft,
    fontWeight: '500',
  },
  formatOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  presetsScroll: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  presetButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    backgroundColor: `${colors.primary}10`,
  },
  dateTimeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateTimeColumn: {
    flex: 1,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOptions: {
    gap: spacing.xs,
  },
  statusOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  statusOptionText: {
    color: colors.inkSoft,
  },
  statusOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  submitSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
});
