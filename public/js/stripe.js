/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const bookTour = async (tourId) => {
  try {
    const stripe = Stripe(
      'pk_test_51KcWRuSHDR30OyTDjBUNfK9aE4hxhAGvd6SCAMqmzIpEpB30TuHa1xueesU4mLeAtV83plYLo3795ub9dxQBeL3u00yWYAhWEf'
    );

    //  1) Get checkout session from API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`
    );
    console.log(session);

    //  2) Create checkout form + charge credit card
    // await stripe.redirectToCheckout({
    //   sessionId: session.data.session.id,
    // });

    window.location.replace(session.data.session.url);
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
