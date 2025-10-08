import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, Text, Card, Button, Icon, Badge, tokens, FAB } from '@/src/design-system';


const STEPS = ['Constraints', 'Suggestions', 'Allocation', 'Review'];
const RISK_LEVELS = ['Conservative', 'Moderate', 'Aggressive'];
const SECTORS = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial'];

const ASSETS = [
  { id: 'AAPL', name: 'Apple Inc.', symbol: 'AAPL', type: 'Stock' },
  { id: 'TSLA', name: 'Tesla Inc.', symbol: 'TSLA', type: 'Stock' },
  { id: 'SPY', name: 'SPDR S&P 500', symbol: 'SPY', type: 'ETF' },
  { id: 'BTC', name: 'Bitcoin', symbol: 'BTC', type: 'Crypto' },
  { id: 'BND', name: 'Vanguard Total Bond', symbol: 'BND', type: 'Bond' },
  { id: 'GLD', name: 'Gold Trust', symbol: 'GLD', type: 'Commodity' },
];

export default function PortfolioBuilderScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRisk, setSelectedRisk] = useState<string>('Moderate');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [allocations] = useState<Record<string, number>>({
    AAPL: 25,
    TSLA: 15,
    SPY: 30,
    BTC: 10,
    BND: 15,
    GLD: 5,
  });

  const toggleSector = (sector: string) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  };

  // Progress calculation for future use
  // const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Portfolio Builder',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Card style={styles.headerCard} elevation="med" noBorder>
          <LinearGradient
            colors={[theme.primary, theme.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <Icon name="portfolio" size={48} color={theme.bg} />
              <Text variant="h1" weight="bold" style={[styles.headerTitle, { color: theme.bg }]}>
                Portfolio Builder
              </Text>
              <Text variant="body" style={[styles.headerSubtitle, { color: theme.bg + 'CC' }]}>
                Create a personalized investment portfolio tailored to your goals and risk tolerance
              </Text>
            </View>
          </LinearGradient>
        </Card>

        {/* Progress Steps */}
        <Card style={styles.stepsCard}>
          <View style={styles.stepsRow}>
            {STEPS.map((step, index) => (
              <View key={step} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    { 
                      backgroundColor: index <= currentStep ? theme.primary : theme.border,
                    }
                  ]}
                >
                  <Text 
                    variant="small" 
                    weight="bold"
                    color={index <= currentStep ? theme.bg : theme.muted}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text variant="xs" muted center numberOfLines={1}>{step}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Step 0: Constraints */}
        {currentStep === 0 && (
          <>
            <Card style={styles.contentCard}>
              <View style={styles.cardHeader}>
                <Icon name="shield" size={28} color={theme.accent} />
                <Text variant="h3" weight="semibold">Define Your Constraints</Text>
              </View>
              <Text variant="small" muted>
                Set your risk tolerance and sector preferences
              </Text>
            </Card>

            {/* Risk Level */}
            <Card style={styles.sectionCard} elevation="low">
              <Text variant="body" weight="semibold">Risk Tolerance</Text>
              <Text variant="small" muted style={styles.sectionDescription}>
                Choose your comfort level with market volatility
              </Text>
              <View style={styles.optionsGrid}>
                {RISK_LEVELS.map((risk) => (
                  <Pressable
                    key={risk}
                    onPress={() => setSelectedRisk(risk)}
                    style={styles.optionButton}
                  >
                    <Card 
                      style={[
                        styles.optionCard,
                        selectedRisk === risk ? { 
                          borderColor: theme.primary, 
                          borderWidth: 2,
                          backgroundColor: theme.primary + '10'
                        } : {}
                      ]}
                      elevation={selectedRisk === risk ? "med" : "low"}
                    >
                      <View style={styles.optionIconContainer}>
                        <Icon 
                          name={selectedRisk === risk ? 'check-shield' : 'shield'} 
                          size={28} 
                          color={selectedRisk === risk ? theme.primary : theme.muted} 
                        />
                      </View>
                      <Text 
                        variant="small" 
                        weight="semibold"
                        color={selectedRisk === risk ? theme.primary : theme.text}
                        center
                      >
                        {risk}
                      </Text>
                      <Text variant="xs" muted center>
                        {(() => {
                          switch (risk) {
                            case 'Conservative':
                              return 'Low risk, steady returns';
                            case 'Moderate':
                              return 'Balanced approach';
                            default:
                              return 'Higher risk, higher potential';
                          }
                        })()}
                      </Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </Card>

            {/* Sectors */}
            <Card style={styles.sectionCard}>
              <Text variant="body" weight="semibold">Preferred Sectors</Text>
              <Text variant="small" muted>Select one or more</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.sectorsScroll}
                contentContainerStyle={styles.sectorsContent}
              >
                {SECTORS.map((sector) => (
                  <Pressable
                    key={sector}
                    onPress={() => toggleSector(sector)}
                    style={styles.sectorButton}
                  >
                    <Badge 
                      variant={selectedSectors.includes(sector) ? 'success' : 'secondary'}
                      size="medium"
                    >
                      {sector}
                    </Badge>
                  </Pressable>
                ))}
              </ScrollView>
            </Card>
          </>
        )}

        {/* Step 1: Suggestions */}
        {currentStep === 1 && (
          <>
            <Card style={styles.contentCard}>
              <View style={styles.cardHeader}>
                <Icon name="portfolio" size={28} color={theme.primary} />
                <Text variant="h3" weight="semibold">AI Suggestions</Text>
              </View>
              <Text variant="small" muted>
                Based on your constraints, here are recommended portfolios
              </Text>
            </Card>

            {['Balanced Growth', 'Tech Focus', 'Dividend Income'].map((portfolio, index) => (
              <Card key={portfolio} style={styles.portfolioCard}>
                <Text variant="body" weight="bold">{portfolio}</Text>
                <Text variant="small" muted>Expected return: {12 + index * 2}% annually</Text>
                <Button 
                  variant={selectedPortfolio === portfolio ? "primary" : "secondary"} 
                  size="small"
                  onPress={() => setSelectedPortfolio(portfolio)}
                >
                  {selectedPortfolio === portfolio ? 'Selected' : 'Select Portfolio'}
                </Button>
              </Card>
            ))}
          </>
        )}

        {/* Step 2: Allocation */}
        {currentStep === 2 && (
          <>
            <Card style={styles.contentCard}>
              <View style={styles.cardHeader}>
                <Icon name="sliders" size={28} color={theme.primary} />
                <Text variant="h3" weight="semibold">Asset Allocation</Text>
              </View>
              <Text variant="small" muted>
                Adjust the allocation percentages for each asset
              </Text>
            </Card>

            {/* Allocation Sliders */}
            <Card style={styles.allocationCard}>
              <Text variant="body" weight="semibold">Portfolio Allocation</Text>
              <Text variant="small" muted>
                Total: {Object.values(allocations).reduce((sum, val) => sum + val, 0)}%
              </Text>
              
              {ASSETS.map((asset) => (
                <View key={asset.id} style={styles.sliderContainer}>
                  <View style={styles.assetHeader}>
                    <View style={styles.assetInfo}>
                      <Text variant="body" weight="semibold">{asset.symbol}</Text>
                      <Text variant="small" muted>{asset.name}</Text>
                    </View>
                    <View style={styles.allocationValue}>
                      <Text variant="body" weight="bold" color={theme.primary}>
                        {allocations[asset.id]}%
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sliderContainer}>
                    <View style={styles.sliderTrack}>
                      <View 
                        style={[
                          styles.sliderFill, 
                          { width: `${(allocations[asset.id] / 50) * 100}%` }
                        ]} 
                      />
                      <View 
                        style={[
                          styles.sliderThumb, 
                          { left: `${(allocations[asset.id] / 50) * 100}%` }
                        ]} 
                      />
                    </View>
                    <View style={styles.sliderLabels}>
                      <Text variant="xs" muted>0%</Text>
                      <Text variant="xs" muted>50%</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>

            {/* Add/Remove Assets */}
            <Card style={styles.assetsCard}>
              <Text variant="body" weight="semibold">Manage Assets</Text>
              <View style={styles.assetActions}>
                <Button 
                  variant="secondary" 
                  size="small"
                  icon={<Icon name="plus" size={16} color={theme.primary} />}
                >
                  Add Asset
                </Button>
                <Button 
                  variant="ghost" 
                  size="small"
                  icon={<Icon name="trash" size={16} color={theme.danger} />}
                >
                  Remove Selected
                </Button>
              </View>
            </Card>
          </>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <>
            <Card style={styles.contentCard}>
              <View style={styles.cardHeader}>
                <Icon name="check-circle" size={28} color={theme.primary} />
                <Text variant="h3" weight="semibold">Portfolio Review</Text>
              </View>
              <Text variant="small" muted>
                Review your portfolio configuration before saving
              </Text>
            </Card>

            {/* Portfolio Summary */}
            <Card style={styles.summaryCard}>
              <Text variant="body" weight="semibold">Portfolio Summary</Text>
              <View style={styles.summaryRow}>
                <Text variant="small" muted>Risk Level:</Text>
                <Badge variant="secondary" size="small">{selectedRisk}</Badge>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="small" muted>Selected Portfolio:</Text>
                <Text variant="small" weight="semibold">{selectedPortfolio}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="small" muted>Total Allocation:</Text>
                <Text variant="small" weight="semibold">
                  {Object.values(allocations).reduce((sum, val) => sum + val, 0)}%
                </Text>
              </View>
            </Card>

            {/* Allocation Breakdown */}
            <Card style={styles.breakdownCard}>
              <Text variant="body" weight="semibold">Allocation Breakdown</Text>
              {ASSETS.filter(asset => allocations[asset.id] > 0).map((asset) => (
                <View key={asset.id} style={styles.breakdownRow}>
                  <View style={styles.assetInfo}>
                    <Text variant="small" weight="semibold">{asset.symbol}</Text>
                    <Text variant="xs" muted>{asset.name}</Text>
                  </View>
                  <View style={styles.breakdownValue}>
                    <Text variant="small" weight="bold">{allocations[asset.id]}%</Text>
                    <View style={[styles.progressBar, { width: `${allocations[asset.id]}%` }]} />
                  </View>
                </View>
              ))}
            </Card>

            {/* Action Buttons */}
            <View style={styles.reviewActions}>
              <Button
                variant="secondary"
                size="large"
                icon={<Icon name="play" size={20} color={theme.primary} />}
                style={styles.reviewButton}
              >
                Simulate Portfolio
              </Button>
              <Button
                variant="primary"
                size="large"
                icon={<Icon name="save" size={20} color={theme.bg} />}
                style={styles.reviewButton}
              >
                Save Portfolio
              </Button>
            </View>
          </>
        )}

        {/* Navigation */}
        <View style={styles.navigation}>
          {currentStep > 0 && (
            <Button
              variant="ghost"
              size="large"
              onPress={() => setCurrentStep(currentStep - 1)}
              style={styles.navButton}
            >
              Back
            </Button>
          )}
          <Button
            variant="primary"
            size="large"
            onPress={() => {
              if (currentStep < STEPS.length - 1) {
                setCurrentStep(currentStep + 1);
              } else {
                // Portfolio saved, navigate back
                router.push('/(tabs)/opportunities');
              }
            }}
            style={styles.navButton}
            fullWidth={currentStep === 0}
            disabled={currentStep === 1 && !selectedPortfolio}
          >
            {currentStep < STEPS.length - 1 ? 'Next' : 'Create Portfolio'}
          </Button>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
      
      <FAB onPress={() => router.push('/ai-chat')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  headerCard: {
    overflow: 'hidden',
    padding: 0,
  },
  headerGradient: {
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.lg,
  },
  headerContent: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  headerTitle: {
    textAlign: 'center',
  },
  headerSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  stepsCard: {},
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    width: 70,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCard: {
    gap: tokens.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  sectionCard: {
    gap: tokens.spacing.sm,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  optionButton: {
    flex: 1,
  },
  optionCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
    minHeight: 120,
    justifyContent: 'center',
  },
  optionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionDescription: {
    marginBottom: tokens.spacing.sm,
  },
  sectorsScroll: {
    marginVertical: tokens.spacing.sm,
  },
  sectorsContent: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
  },
  sectorButton: {
    flexShrink: 0,
  },
  portfolioCard: {
    gap: tokens.spacing.sm,
  },
  navigation: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  navButton: {
    flex: 1,
  },
  allocationCard: {
    gap: tokens.spacing.md,
  },
  sliderContainer: {
    gap: tokens.spacing.sm,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetInfo: {
    gap: 2,
  },
  allocationValue: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  slider: {
    marginVertical: tokens.spacing.xs,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    position: 'relative',
    marginBottom: tokens.spacing.xs,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#00FF6A',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    backgroundColor: '#00FF6A',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginLeft: -10,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assetsCard: {
    gap: tokens.spacing.sm,
  },
  assetActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  summaryCard: {
    gap: tokens.spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownCard: {
    gap: tokens.spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  breakdownValue: {
    alignItems: 'flex-end',
    gap: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#00FF6A',
    borderRadius: 2,
    minWidth: 20,
  },
  reviewActions: {
    gap: tokens.spacing.sm,
  },
  reviewButton: {
    flex: 1,
  },
});
