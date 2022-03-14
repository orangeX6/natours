/*  eslint-disable */
import 'regenerator-runtime/runtime';
import '@babel/polyfill';
import { displayMap } from './mapbox';
import { login, logout } from './login';
import { signup } from './signup';
import { updateSettings } from './updateSettings';
import { bookTour } from './stripe';

//  DOM ELEMENTS
const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const logOutBtn = document.querySelector('.nav__el--logout');
const signupForm = document.querySelector('.form--sign-up');
const updateUserForm = document.querySelector('.form-user-data');
const updatePasswordForm = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');
// const tourIdBtn = document.getElementById('tour-name');
// let tourId = '';

// DELEGATION
if (mapBox) {
  const locations = JSON.parse(mapBox.dataset.locations);
  displayMap(locations);
}

window.onload = function () {
  if (loginForm)
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      //  VALUES
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      login(email, password);
    });

  if (signupForm)
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const passwordConfirm = document.getElementById('passwordConfirm').value;

      signup(username, email, password, passwordConfirm);
    });
};

// window.addEventListener('DOMContentLoaded', function () {
//   document.querySelector('.signup').addEventListener('submit', (e) => {
//     e.preventDefault();

//     const username = document.getElementById('name').value;
//     const email = document.getElementById('email').value;
//     const password = document.getElementById('password').value;
//     const passwordConfirm = document.getElementById('passwordConfirm').value;

//     signup(username, email, password, passwordConfirm);
//   });
// });

if (logOutBtn) logOutBtn.addEventListener('click', logout);

if (updateUserForm)
  updateUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]);

    await updateSettings(form, 'data');

    if (document.getElementById('photo').files[0]) {
      const updatedPhoto = document.getElementById('photo').files[0].name;
      // document.getElementById('user-photo').src = `img/users/${updatedPhoto}`;
      document
        .querySelectorAll('#user-photo')
        .forEach((i) => (i.src = `img/users/${updatedPhoto}`));
    }
  });

if (updatePasswordForm)
  updatePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelector('.btn--save-password').textContent = 'Updating...';

    const passwordCurrent = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    await updateSettings(
      { passwordCurrent, password, passwordConfirm },
      'password'
    );

    document.getElementById('password-current').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password-confirm').value = '';
    document.querySelector('.btn--save-password').textContent = 'Save Password';
  });

if (bookBtn)
  bookBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.target.textContent = 'Processing...';
    const { tourId } = e.target.dataset;
    bookTour(tourId);
  });

// if (tourIdBtn)
//   tourIdBtn.addEventListener('click', (e) => {
//     tourId = e.target.dataset.tourId;
//   });
