import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Sparkles,
  Calendar,
  Stethoscope,
  PawPrint,
  FileText,
  ChevronRight,
  Plus,
  Star,
  Clock,
  Video,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { NotificationBell } from '../../src/components/notifications/NotificationBell';
import { useAuthStore } from '../../src/store/authStore';
import { useAppointments } from '../../src/hooks/useAppointments';
import { usePets } from '../../src/hooks/usePets';
import { useVets } from '../../src/hooks/useVets';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { Pet } from '../../src/types/pet';
import { VetProfile } from '../../src/types/vet';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: upcomingAppointments = [] } = useAppointments('upcoming');
  const { data: pets = [] } = usePets();
  const { data: vets = [] } = useVets();

  const nextAppointment = upcomingAppointments[0];
  const featuredVets = vets.slice(0, 2);

  const formatAppointmentTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getGreeting = () => {
    if (user?.fullName) {
      const firstName = user.fullName.split(' ')[0];
      return `Welcome back, ${firstName}`;
    }
    return 'Premier Veterinary Telemedicine';
  };

  return (
    <Screen scrollable>
      {/* Brand Header */}
      <View style={styles.header}>
        <View>
          <Text variant="caption" color={colors.inkSoft}>
            THE PETS CLUB
          </Text>
          <Heading level={1} style={styles.brandTitle}>
            Vetopia
          </Heading>
          <Text variant="bodySm" color={colors.muted}>
            {getGreeting()}
          </Text>
        </View>
        <NotificationBell />
      </View>

      {/* Emergency & AI Triage Banner */}
      <TouchableOpacity
        onPress={() => router.push('/ai/chat')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open 24/7 AI Veterinary Triage"
        testID="banner-ai-triage"
      >
        <Card style={styles.triageBanner} elevated={false}>
          <View style={styles.bannerIconContainer}>
            <Sparkles size={20} color={colors.ink} />
          </View>
          <View style={styles.bannerContent}>
            <Heading level={4} style={styles.bannerTitle}>
              24/7 AI Veterinary Triage
            </Heading>
            <Text variant="bodySm" color={colors.inkSoft}>
              Instant emergency symptom assessment & guidance.
            </Text>
          </View>
          <ChevronRight size={18} color={colors.ink} />
        </Card>
      </TouchableOpacity>

      {/* Next Consultation Spotlight */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Heading level={3}>Upcoming Consultation</Heading>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/appointments')}
            accessibilityRole="button"
            accessibilityLabel="View all appointments"
          >
            <Text variant="caption" color={colors.primaryDark} style={styles.sectionActionText}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {nextAppointment ? (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/appointments')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Next appointment details"
          >
            <Card style={styles.appointmentSpotlightCard}>
              <View style={styles.spotlightHeader}>
                <View style={styles.spotlightBadgeRow}>
                  <Badge variant="scheduled" label="Confirmed" />
                  <View style={styles.modeIndicator}>
                    <Video size={13} color={colors.inkSoft} style={{ marginRight: 4 }} />
                    <Text variant="caption" color={colors.inkSoft}>
                      {nextAppointment.mode.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text variant="caption" color={colors.primaryDark} style={styles.urgentBadge}>
                  {nextAppointment.urgency === 'emergency' ? 'EMERGENCY' : ''}
                </Text>
              </View>

              <View style={styles.spotlightBody}>
                <Avatar
                  name={nextAppointment.vet?.name || 'Veterinarian'}
                  source={nextAppointment.vet?.img_key || undefined}
                  size={46}
                />
                <View style={styles.spotlightInfo}>
                  <Heading level={4}>Dr. {nextAppointment.vet?.name || 'Doctor'}</Heading>
                  <Text variant="bodySm" color={colors.inkSoft}>
                    {nextAppointment.vet?.specialty || 'General Practice'}
                  </Text>
                  {nextAppointment.pet_name ? (
                    <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                      Patient: {nextAppointment.pet_name}{' '}
                      {nextAppointment.species ? `(${nextAppointment.species})` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.spotlightFooter}>
                <View style={styles.timeRow}>
                  <Clock size={14} color={colors.inkSoft} />
                  <Text variant="bodySm" color={colors.ink} style={styles.timeText}>
                    {formatAppointmentTime(nextAppointment.starts_at)}
                  </Text>
                </View>
                <Button
                  title="View Details"
                  size="sm"
                  onPress={() => router.push('/(tabs)/appointments')}
                />
              </View>
            </Card>
          </TouchableOpacity>
        ) : (
          <Card style={styles.emptyAppointmentCard}>
            <View style={styles.emptyAppointmentRow}>
              <View style={styles.emptyIconCircle}>
                <Calendar size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.emptyAppointmentText}>
                <Heading level={4}>No Consultations Scheduled</Heading>
                <Text variant="bodySm" color={colors.muted}>
                  Connect with licensed veterinarians for video checkups or advice.
                </Text>
              </View>
            </View>
            <Button
              title="Find a Veterinarian"
              size="sm"
              variant="outline"
              leftIcon={<Stethoscope size={16} color={colors.ink} />}
              onPress={() => router.push('/(tabs)/vets')}
              style={styles.emptyBookBtn}
            />
          </Card>
        )}
      </View>

      {/* Household Pets Quick Access */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Heading level={3}>My Pets</Heading>
          <TouchableOpacity
            onPress={() => router.push('/pets/add')}
            style={styles.addPetHeaderBtn}
            accessibilityRole="button"
            accessibilityLabel="Add new pet"
          >
            <Plus size={16} color={colors.ink} />
            <Text variant="bodySm" color={colors.ink} style={styles.addPetBtnText}>
              Add Pet
            </Text>
          </TouchableOpacity>
        </View>

        {pets.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.petsScrollContent}
          >
            {pets.map((pet: Pet) => (
              <TouchableOpacity
                key={pet.id}
                onPress={() => router.push({ pathname: '/pets/[id]', params: { id: pet.id } })}
                activeOpacity={0.8}
                style={styles.petItemWrapper}
              >
                <Card style={styles.petItemCard}>
                  <Avatar name={pet.name} source={pet.photo_url} size={50} />
                  <Heading level={4} style={styles.petName} numberOfLines={1}>
                    {pet.name}
                  </Heading>
                  <Text variant="caption" color={colors.inkSoft} numberOfLines={1}>
                    {pet.species} {pet.breed ? `• ${pet.breed}` : ''}
                  </Text>
                  <View style={styles.petPassportPill}>
                    <Text variant="caption" color={colors.primaryDark} style={styles.petPillText}>
                      Passport →
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Card style={styles.emptyPetsCard}>
            <View style={styles.emptyPetsRow}>
              <View style={styles.emptyIconCircle}>
                <PawPrint size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.emptyPetsContent}>
                <Heading level={4}>Digital Pet Health Passport</Heading>
                <Text variant="bodySm" color={colors.muted}>
                  Register your companions to track vaccination records and medical notes.
                </Text>
              </View>
            </View>
            <Button
              title="Register Your First Pet"
              size="sm"
              leftIcon={<Plus size={16} color={colors.ink} />}
              onPress={() => router.push('/pets/add')}
              style={styles.registerPetBtn}
            />
          </Card>
        )}
      </View>

      {/* Clinical Portal Quick Actions */}
      <View style={styles.section}>
        <Heading level={3} style={styles.sectionTitle}>
          Clinical Portal
        </Heading>

        <View style={styles.quickGrid}>
          {/* Find a Doctor */}
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(tabs)/vets')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Find a veterinarian"
          >
            <Card style={styles.actionCard}>
              <View style={[styles.actionIconBox, { backgroundColor: '#EBF8D3' }]}>
                <Stethoscope size={20} color={colors.primaryDark} />
              </View>
              <Heading level={4} style={styles.actionTitle}>
                Find a Vet
              </Heading>
              <Text variant="caption" color={colors.inkSoft} style={styles.actionSubtitle}>
                12 specialties & 11 languages
              </Text>
            </Card>
          </TouchableOpacity>

          {/* Appointments Hub */}
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(tabs)/appointments')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Upcoming appointments"
          >
            <Card style={styles.actionCard}>
              <View style={[styles.actionIconBox, { backgroundColor: '#E3F2FD' }]}>
                <Calendar size={20} color="#1E88E5" />
              </View>
              <Heading level={4} style={styles.actionTitle}>
                Appointments
              </Heading>
              <Text variant="caption" color={colors.inkSoft} style={styles.actionSubtitle}>
                Schedule & manage consults
              </Text>
            </Card>
          </TouchableOpacity>

          {/* Health Records */}
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(tabs)/care')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Pet health records"
          >
            <Card style={styles.actionCard}>
              <View style={[styles.actionIconBox, { backgroundColor: '#FFF3E0' }]}>
                <PawPrint size={20} color="#FB8C00" />
              </View>
              <Heading level={4} style={styles.actionTitle}>
                Care Hub
              </Heading>
              <Text variant="caption" color={colors.inkSoft} style={styles.actionSubtitle}>
                Health passports & biometrics
              </Text>
            </Card>
          </TouchableOpacity>

          {/* Digital Prescriptions */}
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/prescriptions' as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Digital prescriptions"
          >
            <Card style={styles.actionCard}>
              <View style={[styles.actionIconBox, { backgroundColor: '#F3E5F5' }]}>
                <FileText size={20} color="#8E24AA" />
              </View>
              <Heading level={4} style={styles.actionTitle}>
                Prescriptions
              </Heading>
              <Text variant="caption" color={colors.inkSoft} style={styles.actionSubtitle}>
                Medications & PDF records
              </Text>
            </Card>
          </TouchableOpacity>
        </View>
      </View>

      {/* Featured Veterinarians */}
      {featuredVets.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heading level={3}>Available Veterinarians</Heading>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/vets')}
              accessibilityRole="button"
              accessibilityLabel="View all veterinarians"
            >
              <Text variant="caption" color={colors.primaryDark} style={styles.sectionActionText}>
                See All
              </Text>
            </TouchableOpacity>
          </View>

          {featuredVets.map((vet: VetProfile) => (
            <Card key={vet.id} style={styles.vetPreviewCard}>
              <View style={styles.vetRow}>
                <Avatar name={vet.name} source={vet.img_key || undefined} size={48} />
                <View style={styles.vetInfo}>
                  <View style={styles.vetNameRow}>
                    <Heading level={4}>{vet.name}</Heading>
                    {vet.rating ? (
                      <View style={styles.ratingBadge}>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text variant="caption" color={colors.ink} style={styles.ratingText}>
                          {vet.rating.toFixed(1)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" color={colors.inkSoft}>
                    {vet.specialty} • {vet.country || 'International'} {vet.flag || ''}
                  </Text>
                  <Text variant="caption" color={colors.primaryDark} style={styles.vetFeeText}>
                    ${vet.price_usd} consultation
                  </Text>
                </View>
                <Button
                  title="Book"
                  size="sm"
                  onPress={() =>
                    router.push({
                      pathname: '/booking/[vetId]',
                      params: { vetId: vet.id },
                    })
                  }
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  brandTitle: {
    color: colors.ink,
  },
  triageBanner: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  bannerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: colors.ink,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  sectionActionText: {
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  appointmentSpotlightCard: {
    padding: spacing.md,
    borderColor: colors.primaryDark,
    borderWidth: 1.5,
  },
  spotlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  spotlightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  urgentBadge: {
    fontWeight: '700',
    color: colors.destructive,
  },
  spotlightBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  spotlightInfo: {
    flex: 1,
  },
  spotlightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeText: {
    fontWeight: '600',
  },
  emptyAppointmentCard: {
    padding: spacing.md,
  },
  emptyAppointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAppointmentText: {
    flex: 1,
  },
  emptyBookBtn: {
    marginTop: spacing.md,
  },
  addPetHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
  },
  addPetBtnText: {
    fontWeight: '600',
  },
  petsScrollContent: {
    paddingRight: spacing.md,
    gap: spacing.md,
  },
  petItemWrapper: {
    width: 140,
  },
  petItemCard: {
    alignItems: 'center',
    padding: spacing.md,
  },
  petName: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  petPassportPill: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  petPillText: {
    fontWeight: '700',
  },
  emptyPetsCard: {
    padding: spacing.md,
  },
  emptyPetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyPetsContent: {
    flex: 1,
  },
  registerPetBtn: {
    marginTop: spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    width: '47.5%',
  },
  actionCard: {
    padding: spacing.md,
    height: 120,
    justifyContent: 'space-between',
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: colors.ink,
  },
  actionSubtitle: {
    fontSize: 11,
  },
  vetPreviewCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  vetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  vetInfo: {
    flex: 1,
  },
  vetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontWeight: '700',
    fontSize: 12,
  },
  vetFeeText: {
    fontWeight: '700',
    marginTop: 2,
  },
});
