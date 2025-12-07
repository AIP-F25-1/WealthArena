import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import FloatingChatbot from '../components/FloatingChatbot';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: 'monthly' | 'yearly';
  features: string[];
  popular?: boolean;
  current?: boolean;
}

const Subscription = () => {
  const navigation = useNavigation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    loadSubscriptionPlans();
  }, []);

  const loadSubscriptionPlans = async () => {
    try {
      setLoading(true);
      
      // Mock subscription plans
      const mockPlans: SubscriptionPlan[] = [
        {
          id: 'free',
          name: 'Free',
          price: 0,
          period: 'monthly',
          features: [
            'Basic trading signals',
            'Limited portfolio tracking',
            'Community access',
            'Basic analytics',
            'Email support'
          ],
          current: true,
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 29.99,
          period: 'monthly',
          features: [
            'Advanced AI signals',
            'Unlimited portfolio tracking',
            'Real-time market data',
            'Advanced analytics & risk metrics',
            'Priority support',
            'Custom alerts',
            'Backtesting tools'
          ],
        },
        {
          id: 'premium',
          name: 'Premium',
          price: 59.99,
          period: 'monthly',
          features: [
            'All Pro features',
            'Premium AI models',
            'Portfolio optimization',
            'Advanced risk management',
            'White-label solutions',
            'API access',
            'Dedicated account manager',
            'Custom integrations'
          ],
          popular: true,
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          price: 199.99,
          period: 'monthly',
          features: [
            'All Premium features',
            'Custom AI model training',
            'Multi-user management',
            'Advanced reporting',
            'SLA guarantees',
            'On-premise deployment',
            'Custom development',
            '24/7 phone support'
          ],
        },
      ];

      setPlans(mockPlans);
    } catch (error) {
      console.error('Error loading subscription plans:', error);
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleSubscribe = (plan: SubscriptionPlan) => {
    if (plan.id === 'free') {
      Alert.alert('Free Plan', 'You are already on the free plan!');
      return;
    }

    Alert.alert(
      'Subscribe to Plan',
      `Are you sure you want to subscribe to ${plan.name} for $${plan.price}/${plan.period}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Subscribe', onPress: () => processSubscription(plan) },
      ]
    );
  };

  const processSubscription = async (plan: SubscriptionPlan) => {
    try {
      // Here you would integrate with Stripe or other payment processor
      Alert.alert(
        'Subscription Successful',
        `Welcome to ${plan.name}! Your subscription is now active.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error processing subscription:', error);
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: () => {
          Alert.alert('Subscription Cancelled', 'Your subscription has been cancelled.');
        }},
      ]
    );
  };

  const formatPrice = (price: number, period: string) => {
    if (price === 0) return 'Free';
    return `$${price.toFixed(2)}/${period}`;
  };

  const getYearlyDiscount = (monthlyPrice: number) => {
    const yearlyPrice = monthlyPrice * 12 * 0.8; // 20% discount
    return Math.round((monthlyPrice * 12 - yearlyPrice) / 12);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Subscription Plans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E1B4B', '#312E81']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Subscription</Text>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => {/* Implement help */}}
          >
            <Ionicons name="help-circle" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Billing Period Toggle */}
        <View style={styles.billingToggle}>
          <Text style={styles.billingLabel}>Billing Period</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleOption, billingPeriod === 'monthly' && styles.toggleOptionActive]}
              onPress={() => setBillingPeriod('monthly')}
            >
              <Text style={[styles.toggleText, billingPeriod === 'monthly' && styles.toggleTextActive]}>
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, billingPeriod === 'yearly' && styles.toggleOptionActive]}
              onPress={() => setBillingPeriod('yearly')}
            >
              <Text style={[styles.toggleText, billingPeriod === 'yearly' && styles.toggleTextActive]}>
                Yearly
              </Text>
            </TouchableOpacity>
          </View>
          {billingPeriod === 'yearly' && (
            <Text style={styles.discountText}>Save 20% with yearly billing!</Text>
          )}
        </View>

        {/* Subscription Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <View key={plan.id} style={styles.planCard}>
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>Most Popular</Text>
                </View>
              )}
              
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>
                  {formatPrice(plan.price, billingPeriod)}
                </Text>
                {billingPeriod === 'yearly' && plan.price > 0 && (
                  <Text style={styles.yearlyDiscount}>
                    Save ${getYearlyDiscount(plan.price)}/month
                  </Text>
                )}
              </View>

              <View style={styles.planFeatures}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.subscribeButton,
                  plan.current && styles.currentButton,
                  plan.popular && styles.popularButton
                ]}
                onPress={() => plan.current ? handleCancelSubscription() : handleSubscribe(plan)}
              >
                <Text style={[
                  styles.subscribeButtonText,
                  plan.current && styles.currentButtonText,
                  plan.popular && styles.popularButtonText
                ]}>
                  {plan.current ? 'Current Plan' : `Subscribe to ${plan.name}`}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Current Subscription Info */}
        <View style={styles.currentSubscription}>
          <Text style={styles.currentSubscriptionTitle}>Current Subscription</Text>
          <View style={styles.currentSubscriptionCard}>
            <View style={styles.currentSubscriptionInfo}>
              <Text style={styles.currentPlanName}>Free Plan</Text>
              <Text style={styles.currentPlanStatus}>Active</Text>
            </View>
            <View style={styles.currentSubscriptionDetails}>
              <Text style={styles.currentPlanDescription}>
                You're currently on the free plan with basic features.
              </Text>
              <Text style={styles.currentPlanExpiry}>
                No expiry date
              </Text>
            </View>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I change my plan anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
            </Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Is there a free trial?</Text>
            <Text style={styles.faqAnswer}>
              Yes, all paid plans come with a 14-day free trial. No credit card required.
            </Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What payment methods do you accept?</Text>
            <Text style={styles.faqAnswer}>
              We accept all major credit cards, PayPal, and bank transfers for enterprise plans.
            </Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes, you can cancel your subscription at any time. You'll retain access until the end of your billing period.
            </Text>
          </View>
        </View>
      </ScrollView>

      <FloatingChatbot
        context={{
          current_page: 'subscription',
          billing_period: billingPeriod,
          selected_plan: selectedPlan,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
  },
  loadingText: {
    color: '#A1A1AA',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  helpButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  billingToggle: {
    marginBottom: 24,
  },
  billingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    padding: 4,
  },
  toggleOption: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleOptionActive: {
    backgroundColor: '#6366F1',
  },
  toggleText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleTextActive: {
    color: 'white',
  },
  discountText: {
    color: '#4CAF50',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  plansContainer: {
    gap: 16,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    right: 20,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  popularText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 4,
  },
  yearlyDiscount: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  featureText: {
    color: '#A1A1AA',
    fontSize: 14,
    flex: 1,
  },
  subscribeButton: {
    backgroundColor: '#2A2A3E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  currentButton: {
    backgroundColor: '#4CAF50',
  },
  popularButton: {
    backgroundColor: '#6366F1',
  },
  subscribeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentButtonText: {
    color: 'white',
  },
  popularButtonText: {
    color: 'white',
  },
  currentSubscription: {
    marginBottom: 24,
  },
  currentSubscriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  currentSubscriptionCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
  },
  currentSubscriptionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentPlanName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  currentPlanStatus: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  currentSubscriptionDetails: {
    gap: 4,
  },
  currentPlanDescription: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  currentPlanExpiry: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  faqSection: {
    marginBottom: 20,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 20,
  },
});

export default Subscription;
