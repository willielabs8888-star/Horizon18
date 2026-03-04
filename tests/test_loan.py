"""Tests for loan math module."""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from model.loan import calculate_monthly_payment, accrue_interest, amortize_year


class TestMonthlyPayment(unittest.TestCase):
    def test_known_loan(self):
        """$30,000 at 6.5% for 10 years should be ~$340/month."""
        payment = calculate_monthly_payment(30_000, 0.065, 10)
        self.assertAlmostEqual(payment, 340.98, delta=1.0)

    def test_zero_principal(self):
        self.assertEqual(calculate_monthly_payment(0, 0.065, 10), 0.0)

    def test_negative_principal(self):
        self.assertEqual(calculate_monthly_payment(-1000, 0.065, 10), 0.0)

    def test_zero_rate(self):
        payment = calculate_monthly_payment(12_000, 0.0, 10)
        self.assertAlmostEqual(payment, 100.0, delta=0.01)

    def test_large_loan(self):
        """$100,000 at 7% for 10 years."""
        payment = calculate_monthly_payment(100_000, 0.07, 10)
        self.assertGreater(payment, 1_100)
        self.assertLess(payment, 1_200)


class TestAccrueInterest(unittest.TestCase):
    def test_basic_accrual(self):
        new_balance = accrue_interest(10_000, 0.065)
        self.assertAlmostEqual(new_balance, 10_650, delta=0.01)

    def test_zero_balance(self):
        self.assertEqual(accrue_interest(0, 0.065), 0.0)

    def test_negative_balance(self):
        self.assertEqual(accrue_interest(-1000, 0.065), 0.0)


class TestAmortizeYear(unittest.TestCase):
    def test_basic_amortization(self):
        monthly = calculate_monthly_payment(30_000, 0.065, 10)
        new_bal, interest, principal = amortize_year(30_000, 0.065, monthly)
        self.assertLess(new_bal, 30_000)
        self.assertGreater(interest, 0)
        self.assertGreater(principal, 0)
        self.assertAlmostEqual(interest + principal, monthly * 12, delta=1.0)

    def test_full_payoff(self):
        """Small balance should pay off within one year."""
        new_bal, interest, principal = amortize_year(100, 0.065, 500)
        self.assertAlmostEqual(new_bal, 0.0, delta=0.01)

    def test_zero_balance(self):
        new_bal, interest, principal = amortize_year(0, 0.065, 500)
        self.assertEqual(new_bal, 0.0)
        self.assertEqual(interest, 0.0)
        self.assertEqual(principal, 0.0)

    def test_ten_year_payoff(self):
        """Running amortize_year 10 times should pay off the loan."""
        balance = 30_000.0
        monthly = calculate_monthly_payment(balance, 0.065, 10)
        total_interest = 0.0

        for _ in range(10):
            balance, interest, principal = amortize_year(balance, 0.065, monthly)
            total_interest += interest

        self.assertAlmostEqual(balance, 0.0, delta=1.0)
        self.assertGreater(total_interest, 10_000)  # Interest adds up


if __name__ == "__main__":
    unittest.main()
