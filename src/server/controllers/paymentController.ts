import { Request, Response } from 'express';
import { supabaseAdmin } from '../supabase';
import { PaymentCurrency } from '../../types/database';
import { convertFromUsd, processPaymentGateway, EXCHANGE_RATES_TO_USD } from '../services/paymentService';

export async function getCurrencies(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: {
      baseCurrency: 'USD',
      rates: EXCHANGE_RATES_TO_USD,
      supportedCurrencies: Object.keys(EXCHANGE_RATES_TO_USD),
    },
  });
}

export async function processPayment(req: Request, res: Response) {
  try {
    const userId = req.user?.id || req.body.userId;
    const {
      amountUsd,
      currency = 'USD',
      itemType,
      referenceId,
      paymentMethod = 'card',
    } = req.body;

    if (!userId || !amountUsd || !itemType || !referenceId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'userId, amountUsd, itemType, and referenceId are required.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const safeCurrency = currency as PaymentCurrency;
    const { amount, rate } = convertFromUsd(Number(amountUsd), safeCurrency);

    const gatewayResult = await processPaymentGateway({
      amount,
      currency: safeCurrency,
      paymentMethod,
      itemType,
      referenceId,
    });

    const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: isUserUuid ? userId : null,
        amount,
        currency: safeCurrency,
        exchange_rate_to_usd: rate,
        amount_usd: Number(amountUsd),
        status: gatewayResult.status,
        item_type: itemType,
        reference_id: referenceId,
        transaction_id: gatewayResult.transactionId,
        payment_method: paymentMethod,
        gateway_response: gatewayResult,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    const formatted = {
      id: payment.id,
      _id: payment.id,
      userId: payment.user_id,
      amount: Number(payment.amount),
      currency: payment.currency,
      exchangeRateToUsd: Number(payment.exchange_rate_to_usd),
      amountUsd: Number(payment.amount_usd),
      status: payment.status,
      itemType: payment.item_type,
      referenceId: payment.reference_id,
      transactionId: payment.transaction_id,
      paymentMethod: payment.payment_method,
      gatewayResponse: payment.gateway_response,
      createdAt: payment.created_at,
    };

    return res.status(201).json({
      success: true,
      data: formatted,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Payment processing failed.', code: 'SERVER_ERROR' },
    });
  }
}

export async function getUserPayments(req: Request, res: Response) {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'userId is required.', code: 'VALIDATION_ERROR' },
      });
    }

    let query = supabaseAdmin.from('payments').select('*').order('created_at', { ascending: false });
    const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(userId));
    if (isUserUuid) {
      query = query.eq('user_id', userId);
    }

    const { data: payments, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    const formatted = (payments || []).map((p: any) => ({
      id: p.id,
      _id: p.id,
      userId: p.user_id,
      amount: Number(p.amount),
      currency: p.currency,
      exchangeRateToUsd: Number(p.exchange_rate_to_usd),
      amountUsd: Number(p.amount_usd),
      status: p.status,
      itemType: p.item_type,
      referenceId: p.reference_id,
      transactionId: p.transaction_id,
      paymentMethod: p.payment_method,
      createdAt: p.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch payments.', code: 'SERVER_ERROR' },
    });
  }
}
