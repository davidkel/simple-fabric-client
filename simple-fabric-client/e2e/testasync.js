(async () => {

	const cycle = [1,2,3,4,5];


	const doSleep = async (val) => {
		const promise = new Promise((resolve, reject) => {
			setTimeout(() => {
				console.log('timeout for ' + val + ' fired');
				resolve();
			}, 1000 * val);
		});
		await promise;
	};

	const runme = async (input) => {
		const promises = input.map((val) => doSleep(val));
		console.log('collected all promises');
		return Promise.all(promises);
	};

	runme(cycle);

})();
