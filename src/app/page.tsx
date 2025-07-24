import React from 'react';
import Link from 'next/link';
import { BarChart3, Users, Mail, Shield, Clock, TrendingUp } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <h1 className="ml-2 text-xl font-bold text-gray-900">
                Meta Ads Reporting
              </h1>
            </div>
            <nav className="flex space-x-8">
              <Link
                href="/auth/login"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/login"
                className="btn-primary"
              >
                Get Started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Automate Your
            <span className="text-primary-600"> Meta Ads Reporting</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Professional, automated monthly reports for your Meta Ads campaigns. 
            Save time, impress clients, and scale your agency operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/login" className="btn-primary btn-lg">
              Start Free Trial
            </Link>
            <button className="btn-secondary btn-lg">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need for Professional Reporting
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From data collection to email delivery, we handle the entire reporting workflow
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card card-body text-center">
                <div className="flex justify-center mb-4">
                  <feature.icon className="h-12 w-12 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Set up once, automate forever
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center items-center w-16 h-16 bg-primary-100 text-primary-600 rounded-full text-xl font-bold mx-auto mb-4">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Automate Your Reporting?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join agencies already saving hours every month with automated Meta Ads reports
          </p>
          <Link href="/auth/login" className="btn bg-white text-primary-600 hover:bg-gray-100 btn-lg">
            Get Started Today
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-primary-400" />
              <span className="ml-2 text-xl font-bold">Meta Ads Reporting</span>
            </div>
            <p className="text-gray-400 mb-8">
              Professional automated reporting for Meta Ads specialists
            </p>
            <div className="border-t border-gray-800 pt-8">
              <p className="text-gray-400 text-sm">
                © 2024 Meta Ads Reporting SaaS. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: Clock,
    title: 'Automated Monthly Reports',
    description: 'Set it and forget it. Reports are generated and sent automatically every month.'
  },
  {
    icon: BarChart3,
    title: 'Professional Templates',
    description: 'Beautiful, branded PDF reports that impress clients and showcase results clearly.'
  },
  {
    icon: Users,
    title: 'Client Portal Access',
    description: 'Clients get secure access to view and download all their historical reports.'
  },
  {
    icon: Mail,
    title: 'Email Delivery',
    description: 'Reports are automatically emailed to clients with professional messaging.'
  },
  {
    icon: Shield,
    title: 'Secure & Reliable',
    description: 'Enterprise-grade security with 99.9% uptime and encrypted data storage.'
  },
  {
    icon: TrendingUp,
    title: 'Performance Insights',
    description: 'Beyond data - actionable insights and recommendations for campaign optimization.'
  }
];

const steps = [
  {
    title: 'Add Your Clients',
    description: 'Input client details and Meta Ads API credentials securely in your admin dashboard.'
  },
  {
    title: 'Configure Reports',
    description: 'Set reporting schedules, customize templates, and configure email preferences.'
  },
  {
    title: 'Automate & Scale',
    description: 'Reports generate automatically and clients receive them via email every month.'
  }
]; 