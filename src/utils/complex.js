const mystery = (f => (x => f(v => x(x)(v)))(x => f(v => x(x)(v))))(f => n => 
    n <= 1 ? 1 : n * f(n - 1)
  );
  
  console.log(mystery(5)); // 120 (factorial of 5)